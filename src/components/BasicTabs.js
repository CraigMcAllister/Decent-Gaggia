import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import PropTypes from 'prop-types';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import Espresso from "./Espresso";
import Config from "./Config";
import ARDUINO_IP from '../config';

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 2000;

function TabPanel(props) {
    const { children, value, index, ...other } = props;

    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`simple-tabpanel-${index}`}
            aria-labelledby={`simple-tab-${index}`}
            {...other}
        >
            {value === index && (
                <>{children}</>
            )}
        </div>
    );
}

TabPanel.propTypes = {
    children: PropTypes.node,
    index: PropTypes.number.isRequired,
    value: PropTypes.number.isRequired,
};

function a11yProps(index) {
    return {
        id: `simple-tab-${index}`,
        'aria-controls': `full-width-tabpanel-${index}`,
    };
}

export default function BasicTabs() {
    const [value, setValue] = useState(0);

    const [temp, setTemp] = useState(20);
    const [setPointFromEspresso, setSetPointFromEspresso] = useState(95);
    const [pressureHistory, setPressureHistory] = useState([]);
    const [brewTempHistory, setBrewTempHistory] = useState([]);
    const [brewTimeHistory, setBrewTimeHistory] = useState([]);
    const [isEspressoWsConnected, setIsEspressoWsConnected] = useState(false);
    
    const wsRef = useRef(null);
    const reconnectTimeoutRef = useRef(null);
    const reconnectAttemptsRef = useRef(0);

    const getTimeString = useCallback(() => {
        return Date.now();
    }, []);

    const handleEspressoReconnect = useCallback(() => {
        if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
            console.log('Max reconnection attempts for Espresso WS reached');
            return;
        }
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
        }
        reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            console.log(`Attempting to reconnect Espresso WS (${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})...`);
            initializeEspressoWebSocket();
        }, RECONNECT_DELAY);
    }, []);

    const initializeEspressoWebSocket = useCallback(() => {
        if (wsRef.current) {
            wsRef.current.close();
        }
        const newWs = new WebSocket(`ws://${ARDUINO_IP.ARDUINO_IP}:90/ws`);
        newWs.onopen = () => {
            console.log('Espresso WebSocket connected (from BasicTabs)');
            setIsEspressoWsConnected(true);
            reconnectAttemptsRef.current = 0;
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
                reconnectTimeoutRef.current = null;
            }
        };
        newWs.onmessage = (evt) => {
            try {
                const message = JSON.parse(evt.data);
                setTemp(prevTemp => message.temp !== undefined ? message.temp : prevTemp);
                setSetPointFromEspresso(prevSp => message.setpoint !== undefined ? message.setpoint : prevSp);
                
                const newTime = getTimeString();

                if (message.brewTemp !== undefined && message.pressure !== undefined) {
                     setBrewTempHistory(prev => [...prev, message.brewTemp]);
                     setPressureHistory(prev => [...prev, message.pressure]);
                     setBrewTimeHistory(prev => [...prev, newTime]);
                }
            } catch (error) {
                console.error('Error parsing Espresso WebSocket message:', error);
            }
        };
        newWs.onclose = () => {
            console.log('Espresso WebSocket disconnected (from BasicTabs)');
            setIsEspressoWsConnected(false);
            handleEspressoReconnect();
        };
        newWs.onerror = (error) => {
            console.error('Espresso WebSocket error (from BasicTabs):', error);
            setIsEspressoWsConnected(false);
            handleEspressoReconnect();
        };
        wsRef.current = newWs;
    }, [getTimeString, handleEspressoReconnect]);

    const toggleEspressoConnection = useCallback(() => {
        if (isEspressoWsConnected) {
            if (wsRef.current) {
                wsRef.current.close();
            }
            setIsEspressoWsConnected(false);
             if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
                reconnectTimeoutRef.current = null;
                reconnectAttemptsRef.current = MAX_RECONNECT_ATTEMPTS;
            }
        } else {
            reconnectAttemptsRef.current = 0;
            initializeEspressoWebSocket();
        }
    }, [isEspressoWsConnected, initializeEspressoWebSocket]);

    const clearChartDataInBasicTabs = useCallback(() => {
        setBrewTempHistory([]);
        setPressureHistory([]);
        setBrewTimeHistory([]);
    }, []);

    useEffect(() => {
        return () => {
            if (wsRef.current) {
                wsRef.current.onclose = null;
                wsRef.current.close();
            }
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
        };
    }, [initializeEspressoWebSocket]);

    useEffect(() => {
        try {
            const sessionDataString = sessionStorage.getItem('espressoAppState');
            if (sessionDataString) {
                const storedState = JSON.parse(sessionDataString);
                if (storedState.temp !== undefined) setTemp(storedState.temp);
                if (storedState.setPointFromEspresso !== undefined) setSetPointFromEspresso(storedState.setPointFromEspresso);
                if (storedState.pressureHistory) setPressureHistory(storedState.pressureHistory);
                if (storedState.brewTempHistory) setBrewTempHistory(storedState.brewTempHistory);
                if (storedState.brewTimeHistory) setBrewTimeHistory(storedState.brewTimeHistory);
            }
        } catch (e) {
            console.error("Failed to load state from sessionStorage", e);
        }
    }, []);

    useEffect(() => {
        try {
            const stateToSave = {
                temp,
                setPointFromEspresso,
                pressureHistory,
                brewTempHistory,
                brewTimeHistory,
            };
            sessionStorage.setItem('espressoAppState', JSON.stringify(stateToSave));
        } catch (e) {
            console.error("Failed to save state to sessionStorage", e);
        }
    }, [temp, setPointFromEspresso, pressureHistory, brewTempHistory, brewTimeHistory]);

    const handleChange = (event, newValue) => {
        setValue(newValue);
    };

    const chartDataObject = {
        labels: brewTimeHistory,
        datasets: [
            {
                label: "Temperature",
                data: brewTempHistory,
                backgroundColor: "rgba(79, 195, 247, 0.1)",
                borderColor: "#4FC3F7",
                yAxisID: 'temp',
                fill: true,
                borderWidth: 1.5,
            },
            {
                label: "Pressure",
                data: pressureHistory,
                backgroundColor: "rgba(224, 224, 224, 0.1)",
                borderColor: "#E0E0E0",
                yAxisID: 'pressure',
                fill: true,
                borderWidth: 1.5,
            },
        ]
    };
    
    const latestPressure = pressureHistory.length > 0 ? pressureHistory[pressureHistory.length - 1] : 0;

    return (
        <Box sx={{ width: '100%', bgcolor: 'transparent' }}>
            <Box sx={{ borderBottom: 1, borderColor: '#333333' }}>
                <Tabs
                    value={value}
                    onChange={handleChange}
                    centered
                    aria-label="basic tabs example"
                    TabIndicatorProps={{ sx: { backgroundColor: '#E0E0E0' } }}
                    sx={{
                        '& .MuiTab-root': {
                            textTransform: 'none',
                            color: '#888888',
                            '&.Mui-selected': { color: '#E0E0E0' },
                            '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.05)' }
                        }
                    }}
                >
                    <Tab label="Espresso" {...a11yProps(0)} />
                    <Tab label="Config" {...a11yProps(1)} />
                  </Tabs>
            </Box>
            <TabPanel value={value} index={0}>
                <Espresso 
                    temp={temp}
                    setPoint={setPointFromEspresso}
                    latestPressure={latestPressure}
                    chartData={chartDataObject}
                    isEspressoWsConnected={isEspressoWsConnected}
                    clearChartData={clearChartDataInBasicTabs}
                />
            </TabPanel>
            <TabPanel value={value} index={1}>
                <Config 
                    isEspressoWsConnected={isEspressoWsConnected}
                    toggleEspressoConnection={toggleEspressoConnection}
                    currentMachineSetpoint={setPointFromEspresso}
                />
            </TabPanel>
        </Box>
    );
}
