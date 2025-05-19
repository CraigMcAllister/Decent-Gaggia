import React, {useRef, useState, useEffect, useCallback} from 'react';
import './../App.css';
import ARDUINO_IP from '../config';
import {Button, Slider, Alert, CircularProgress, Typography, Switch} from "@mui/material";

const Config = (props) => {
    const { isEspressoWsConnected, toggleEspressoConnection, currentMachineSetpoint } = props;

    const input = useRef();
    const [isLoading, setIsLoading] = useState(true);
    const [setPointVal, setSetPointVal] = useState(96);
    const [error, setError] = useState(null);
    const [isUpdating, setIsUpdating] = useState(false);

    useEffect(() => {
        if (typeof currentMachineSetpoint === 'number') {
            setSetPointVal(currentMachineSetpoint);
            if (isLoading) setIsLoading(false);
        } else if (isLoading) {
            const timer = setTimeout(() => {
                if (isLoading) {
                    console.warn('Config: currentMachineSetpoint prop not received, using default for slider.');
                    setIsLoading(false);
                }
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [currentMachineSetpoint, isLoading]);

    const debounce = useCallback((func, wait) => {
        let timeout;
        return (...args) => {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }, []);

    const handleChange = (event, newValue) => {
        setSetPointVal(newValue);
        setError(null);
    };

    const submitData = useCallback(async (valueToSubmit) => {
        if (isUpdating) return;
        setIsUpdating(true);
        setError(null);
        
        try {
            let formData = new FormData();
            formData.append('setpoint', valueToSubmit.toString());
            
            const response = await fetch(`http://${ARDUINO_IP.ARDUINO_IP}:80/setPoint`, {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            console.log('Setpoint updated successfully via fetch:', valueToSubmit);
        } catch (err) {
            console.error('Error updating setpoint via fetch:', err);
            setError('Failed to update temperature setpoint. Please try again.');
        } finally {
            setIsUpdating(false);
        }
    }, [isUpdating]);

    const debouncedSubmit = useCallback(debounce(submitData, 700), [submitData]);

    useEffect(() => {
        if (!isLoading && typeof setPointVal === 'number' && setPointVal !== currentMachineSetpoint) {
            debouncedSubmit(setPointVal);
        }
    }, [setPointVal, isLoading, currentMachineSetpoint, debouncedSubmit]);

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
                <>
                    <Typography gutterBottom sx={{ color: '#888888', textAlign: 'left', fontSize: '0.875rem' }}>
                        Temperature Setpoint
                    </Typography>
                    <Slider
                        valueLabelDisplay="auto"
                        value={typeof setPointVal === 'number' ? setPointVal : 0}
                        max={120}
                        min={80}
                        marks
                        onChange={handleChange}
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
                </>
            )}
        </div>
    );
};

export default Config;
