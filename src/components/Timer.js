import React, { useState, useEffect } from 'react';
import { Button, Box, Typography } from '@mui/material';
import './../App.css';

import ARDUINO_IP from '../config';
const Timer = ({ brewSwitch = true, autoControl = false }) => {
    const [seconds, setSeconds] = useState(0);
    const [isActive, setIsActive] = useState(false);

    // Check for brew switch changes when autoControl is enabled
    useEffect(() => {
        if (autoControl && brewSwitch !== undefined) {
            if (!brewSwitch && !isActive) {
                // Brew switch is activated (false = brewing active), start timer
                setIsActive(true);
                toggleBrewPID(true);
            } else if (brewSwitch && isActive) {
                // Brew switch is deactivated, pause timer
                setIsActive(false);
                toggleBrewPID(false);
            }
        }
    }, [brewSwitch, autoControl, isActive]);

    function toggle() {
        setIsActive(!isActive);
        toggleBrewPID(!isActive);
    }

    function toggleBrewPID(brewing = !isActive) {
        let formData = new FormData();
        formData.append('brewing', brewing ? '0' : '1');
        fetch(`http://${ARDUINO_IP.ARDUINO_IP}:80/brewing`,
            {
                method: 'POST',
                body: formData
            })
            .catch(error => {
                console.error(error);
            });
    }
    
    function reset() {
        setSeconds(0);
        setIsActive(false);
        toggleBrewPID(false);
    }

    useEffect(() => {
        let interval = null;
        if (isActive) {
            interval = setInterval(() => {
                setSeconds(seconds => seconds + 1);
            }, 1000);
        } else if (!isActive && seconds !== 0) {
            clearInterval(interval);
        }
        return () => clearInterval(interval);
    }, [isActive, seconds]);

    return (
        <div className="app card">
            <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                // width: '100%',
                padding: '10px'
            }}>
                <Typography variant="h5" sx={{ 
                    fontWeight: 'bold',
                    minWidth: '60px'
                }}>
                    {seconds}s
                </Typography>
                
                <Box sx={{ 
                    display: 'flex', 
                    gap: '8px'
                }}>
                    <Button 
                        variant="outlined"
                        onClick={toggle}
                        sx={{
                            color: '#E0E0E0',
                            borderColor: '#333333',
                            textTransform: 'none',
                            '&:hover': {
                                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                                borderColor: '#E0E0E0',
                            }
                        }}
                    >
                        {isActive ? 'Pause' : 'Start'}
                    </Button>
                    <Button 
                        variant="outlined"
                        onClick={reset}
                        sx={{
                            color: '#E0E0E0',
                            borderColor: '#333333',
                            textTransform: 'none',
                            '&:hover': {
                                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                                borderColor: '#E0E0E0',
                            }
                        }}
                    >
                        Reset
                    </Button>
                </Box>
            </Box>
        </div>
    );
};

export default Timer;
