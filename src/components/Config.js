import React, {useRef, useState, useEffect, useCallback} from 'react';
import './../App.css';
import ARDUINO_IP from '../config';
import {Button, Slider, Alert, CircularProgress, Typography, Switch, Grid, Divider} from "@mui/material";

const Config = (props) => {
    const { isEspressoWsConnected, toggleEspressoConnection, currentMachineSetpoint } = props;

    const input = useRef();
    const [setPointVal, setSetPointVal] = useState(96);
    const [preInfusionTime, setPreInfusionTime] = useState(8);
    const [preInfusionPressure, setPreInfusionPressure] = useState(3);
    const [shotPressure, setShotPressure] = useState(8);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isUpdating, setIsUpdating] = useState(false);
    const isUserChangePending = useRef(false);

    useEffect(() => {
        // Load all settings from localStorage
        const storedSetpoint = localStorage.getItem('setpoint');
        const storedPreInfusionTime = localStorage.getItem('preInfusionTime');
        const storedPreInfusionPressure = localStorage.getItem('preInfusionPressure');
        const storedShotPressure = localStorage.getItem('shotPressure');
        
        if (storedSetpoint !== null) {
            setSetPointVal(parseFloat(storedSetpoint));
        } else if (typeof currentMachineSetpoint === 'number') {
            setSetPointVal(currentMachineSetpoint);
        }
        
        if (storedPreInfusionTime !== null) {
            setPreInfusionTime(parseFloat(storedPreInfusionTime));
        }
        
        if (storedPreInfusionPressure !== null) {
            setPreInfusionPressure(parseFloat(storedPreInfusionPressure));
        }
        
        if (storedShotPressure !== null) {
            setShotPressure(parseFloat(storedShotPressure));
        }
        
        // Initialize config from server when first loading
        fetchConfigFromServer();
        
        setIsLoading(false);
    }, []);

    useEffect(() => {
        if (!isLoading && typeof currentMachineSetpoint === 'number') {
            if (!isUserChangePending.current && !isUpdating) {
                setSetPointVal(currentVal => {
                    if (currentVal !== currentMachineSetpoint) {
                        console.log(`Config: Syncing setPointVal from prop ${currentMachineSetpoint} (was ${currentVal})`);
                        return currentMachineSetpoint;
                    }
                    return currentVal;
                });
            }
        }
    }, [currentMachineSetpoint, isLoading, isUpdating]);

    const fetchConfigFromServer = async () => {
        try {
            const response = await fetch(`http://${ARDUINO_IP.ARDUINO_IP}:80/getConfig`);
            if (response.ok) {
                const config = await response.json();
                if (config.preInfusionTime) setPreInfusionTime(config.preInfusionTime);
                if (config.preInfusionPressure) setPreInfusionPressure(config.preInfusionPressure);
                if (config.shotPressure) setShotPressure(config.shotPressure);
                console.log('Config loaded from server:', config);
            }
        } catch (err) {
            console.error('Failed to fetch config from server:', err);
        }
    };

    const debounce = useCallback((func, wait) => {
        let timeout;
        return (...args) => {
            isUserChangePending.current = true;
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }, []);

    const submitData = useCallback(async (valueToSubmit, paramName) => {
        if (isUpdating) return;

        setIsUpdating(true);
        setError(null);
        
        try {
            let formData = new FormData();
            formData.append(paramName, valueToSubmit.toString());
            
            let endpoint = 'setPoint';
            if (paramName !== 'setpoint') {
                endpoint = 'config';
            }
            
            const response = await fetch(`http://${ARDUINO_IP.ARDUINO_IP}:80/${endpoint}`, {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            // Save to localStorage for client-side persistence
            localStorage.setItem(paramName, valueToSubmit.toString());
            console.log(`${paramName} updated successfully:`, valueToSubmit);
        } catch (err) {
            console.error(`Error updating ${paramName}:`, err);
            setError(`Failed to update ${paramName}. Please try again.`);
        } finally {
            setIsUpdating(false);
            isUserChangePending.current = false;
        }
    }, [isUpdating]);

    const debouncedSubmit = useCallback(debounce((value, paramName) => submitData(value, paramName), 700), [submitData, debounce]);

    const handleSetpointChange = (event, newValue) => {
        setSetPointVal(newValue);
        setError(null);
        debouncedSubmit(newValue, 'setpoint');
    };

    const handlePreInfusionTimeChange = (event, newValue) => {
        setPreInfusionTime(newValue);
        setError(null);
        debouncedSubmit(newValue, 'preInfusionTime');
    };

    const handlePreInfusionPressureChange = (event, newValue) => {
        setPreInfusionPressure(newValue);
        setError(null);
        debouncedSubmit(newValue, 'preInfusionPressure');
    };

    const handleShotPressureChange = (event, newValue) => {
        setShotPressure(newValue);
        setError(null);
        debouncedSubmit(newValue, 'shotPressure');
    };

    return (
        <div className="container card" style={{ marginTop: '16px' }}>
            <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                paddingBottom: '16px', 
                marginBottom: '16px', 
                borderBottom: '1px solid #333333' 
            }}>
                <Typography sx={{ color: '#E0E0E0', fontSize: '1rem' }}>Data Stream</Typography>
                <Switch
                    checked={isEspressoWsConnected}
                    onChange={toggleEspressoConnection}
                    inputProps={{ 'aria-label': 'Toggle machine data stream' }}
                    sx={{
                        '& .MuiSwitch-switchBase.Mui-checked': { color: '#E0E0E0', '&:hover': { backgroundColor: 'rgba(224, 224, 224, 0.08)' } },
                        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#4CAF50', opacity: 1 },
                        '& .MuiSwitch-switchBase': { color: '#B0B0B0' },
                        '& .MuiSwitch-track': { backgroundColor: '#424242', opacity: 1 },
                    }}
                />
            </div>

            {error && 
                <Alert 
                    severity="error" 
                    sx={{ mb: 2, bgcolor: '#2A2A2A',color: '#FFBABA', border: '1px solid #5A3E3E', '& .MuiAlert-icon': {color: '#FFBABA'} }}
                >
                    {error}
                </Alert>
            }
            {isLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
                    <CircularProgress sx={{ color: '#E0E0E0' }} />
                </div>
            ) : (
                <Grid container spacing={3}>
                    <Grid item xs={12}>
                        <Typography gutterBottom sx={{ color: '#888888', textAlign: 'left', fontSize: '0.875rem' }}>
                            Temperature Setpoint
                        </Typography>
                        <Slider
                            valueLabelDisplay="auto"
                            value={typeof setPointVal === 'number' ? setPointVal : 0}
                            max={120}
                            min={80}
                            marks
                            onChange={handleSetpointChange}
                            disabled={isUpdating}
                            ref={input}
                            sx={{
                                color: '#E0E0E0',
                                '& .MuiSlider-thumb': { backgroundColor: '#E0E0E0' },
                                '& .MuiSlider-rail': { color: '#424242', opacity: 1 },
                                '& .MuiSlider-track': { color: '#E0E0E0' },
                                '& .MuiSlider-markLabel': { color: '#888888' },
                                '& .MuiSlider-mark': { backgroundColor: '#888888' }
                            }}
                        />
                        <div style={{ marginTop: '10px', color: '#E0E0E0', textAlign: 'right' }}>
                            {`${typeof setPointVal === 'number' ? setPointVal.toFixed(1) : 'N/A'}°C`}
                        </div>
                    </Grid>
                    
                    <Grid item xs={12}>
                        <Divider sx={{ my: 2, bgcolor: '#333333' }} />
                        <Typography gutterBottom sx={{ color: '#E0E0E0', textAlign: 'left', fontSize: '1rem', mb: 2 }}>
                            Extraction Parameters
                        </Typography>
                    </Grid>
                    
                    <Grid item xs={12}>
                        <Typography gutterBottom sx={{ color: '#888888', textAlign: 'left', fontSize: '0.875rem' }}>
                            Pre-Infusion Time (seconds)
                        </Typography>
                        <Slider
                            valueLabelDisplay="auto"
                            value={preInfusionTime}
                            max={15}
                            min={0}
                            step={0.5}
                            marks
                            onChange={handlePreInfusionTimeChange}
                            disabled={isUpdating}
                            sx={{
                                color: '#4FC3F7',
                                '& .MuiSlider-thumb': { backgroundColor: '#4FC3F7' },
                                '& .MuiSlider-rail': { color: '#424242', opacity: 1 },
                                '& .MuiSlider-track': { color: '#4FC3F7' },
                                '& .MuiSlider-markLabel': { color: '#888888' },
                                '& .MuiSlider-mark': { backgroundColor: '#888888' }
                            }}
                        />
                        <div style={{ marginTop: '10px', color: '#E0E0E0', textAlign: 'right' }}>
                            {`${preInfusionTime.toFixed(1)} sec`}
                        </div>
                    </Grid>
                    
                    <Grid item xs={12}>
                        <Typography gutterBottom sx={{ color: '#888888', textAlign: 'left', fontSize: '0.875rem' }}>
                            Pre-Infusion Pressure (bar)
                        </Typography>
                        <Slider
                            valueLabelDisplay="auto"
                            value={preInfusionPressure}
                            max={6}
                            min={1}
                            step={0.1}
                            marks
                            onChange={handlePreInfusionPressureChange}
                            disabled={isUpdating}
                            sx={{
                                color: '#FFC107',
                                '& .MuiSlider-thumb': { backgroundColor: '#FFC107' },
                                '& .MuiSlider-rail': { color: '#424242', opacity: 1 },
                                '& .MuiSlider-track': { color: '#FFC107' },
                                '& .MuiSlider-markLabel': { color: '#888888' },
                                '& .MuiSlider-mark': { backgroundColor: '#888888' }
                            }}
                        />
                        <div style={{ marginTop: '10px', color: '#E0E0E0', textAlign: 'right' }}>
                            {`${preInfusionPressure.toFixed(1)} bar`}
                        </div>
                    </Grid>
                    
                    <Grid item xs={12}>
                        <Typography gutterBottom sx={{ color: '#888888', textAlign: 'left', fontSize: '0.875rem' }}>
                            Shot Pressure (bar)
                        </Typography>
                        <Slider
                            valueLabelDisplay="auto"
                            value={shotPressure}
                            max={12}
                            min={4}
                            step={0.1}
                            marks
                            onChange={handleShotPressureChange}
                            disabled={isUpdating}
                            sx={{
                                color: '#E0E0E0',
                                '& .MuiSlider-thumb': { backgroundColor: '#E0E0E0' },
                                '& .MuiSlider-rail': { color: '#424242', opacity: 1 },
                                '& .MuiSlider-track': { color: '#E0E0E0' },
                                '& .MuiSlider-markLabel': { color: '#888888' },
                                '& .MuiSlider-mark': { backgroundColor: '#888888' }
                            }}
                        />
                        <div style={{ marginTop: '10px', color: '#E0E0E0', textAlign: 'right' }}>
                            {`${shotPressure.toFixed(1)} bar`}
                        </div>
                    </Grid>
                </Grid>
            )}
        </div>
    );
};

export default Config;
