import {Switch, Button, Chip} from "@mui/material";
import React from 'react';
import {Line} from "react-chartjs-2";
import './../App.css';
import Timer from "./Timer";

interface IProps {
    temp: number;
    setPoint: number;
    latestPressure: number;
    chartData: any;
    isEspressoWsConnected: boolean;
    clearChartData: () => void;
    brewSwitch?: boolean;
    pumpDuty?: number;
    isPreInfusing?: boolean;
    pumpOnTime?: number;
    shotGrams?: number;
}

interface IState {
    advancedMode: boolean;
}

const chartOptionsOriginal = {
    responsive: true,
    maintainAspectRatio: false,
    elements: {
        point: {
            radius: 0
        }
    },
    scales: {
        yAxes: [{
            position: "right",
            "id": "pressure",
            gridLines: {
                display: true,
                color: 'rgba(255, 255, 255, 0.1)',
                drawBorder: false,
            },
            ticks: {
                suggestedMin: 0,
                maxTicksLimit: 4,
                fontColor: '#888888',
                padding: 10,
            }
        }, {
            position: "left",
            "id": "temp",
            gridLines: {
                display: true,
                color: 'rgba(255, 255, 255, 0.1)',
                drawBorder: false,
            },
            ticks: {
                suggestedMin: 80,
                maxTicksLimit: 4,
                fontColor: '#888888',
                padding: 10,
            }
        }, {
            position: "left",
            "id": "pumpDuty",
            gridLines: {
                display: false,
                color: 'rgba(255, 255, 255, 0.1)',
                drawBorder: false,
            },
            ticks: {
                suggestedMin: 0,
                suggestedMax: 200,
                maxTicksLimit: 4,
                fontColor: '#888888',
                padding: 10,
            }
        }],
        xAxes: [{
            type: 'time',
            time: {
                unit: 'second',
                displayFormats: {
                    'second': 'HH:mm:ss',
                    'minute': 'HH:mm',
                    'hour': 'HH:mm'
                },
                tooltipFormat: 'HH:mm:ss',
            },
            gridLines: {
                display: false,
            },
            ticks: {
                autoSkip: true,
                maxTicksLimit: 10,
                fontColor: '#888888',
                padding: 10,
            },
        }]
    },
    legend: {
        display: true,
        labels: {
            fontColor: '#888888',
            boxWidth: 12,
            padding: 15,
        }
    },
    tooltips: {
        enabled: false,
        backgroundColor: '#2A2A2A',
        titleFontColor: '#E0E0E0',
        bodyFontColor: '#E0E0E0',
        borderColor: '#333333',
        borderWidth: 1,
        cornerRadius: 4,
        mode: 'index',
        intersect: false,
    }
}

class Espresso extends React.Component<IProps, IState> {
    private myRef: React.RefObject<Line>;

    constructor(props: IProps) {
        super(props);
        this.myRef = React.createRef();
        this.state = {
            advancedMode: false,
        };
    }

    componentDidMount() {
        if (this.myRef.current && this.myRef.current.chartInstance) {
            this.myRef.current.chartInstance.update();
        }
    }

    componentWillUnmount() {
        // Any cleanup specific to Espresso component, if necessary
    }

    toggleAdvancedMode = () => {
        this.setState(prevState => ({ advancedMode: !prevState.advancedMode }), () => {
            if (this.myRef.current && this.myRef.current.chartInstance) {
                // Show/hide advanced datasets based on advanced mode toggle
                const chartInstance = this.myRef.current.chartInstance;
                
                // Toggle pump duty dataset
                const pumpDutyDataset = chartInstance.data.datasets.find((ds: any) => ds.label === "Pump Duty");
                if (pumpDutyDataset) {
                    pumpDutyDataset.hidden = !this.state.advancedMode;
                }
                
                // Toggle shot weight dataset (if it exists)
                const shotWeightDataset = chartInstance.data.datasets.find((ds: any) => ds.label === "Shot Weight");
                if (shotWeightDataset) {
                    shotWeightDataset.hidden = !this.state.advancedMode;
                }
                
                // Update chart after a short delay to ensure all changes are applied
                setTimeout(() => {
                    if (this.myRef.current && this.myRef.current.chartInstance) {
                        this.myRef.current.chartInstance.update();
                    }
                }, 0);
            }
        });
    }

    handleClearChartData = () => {
        this.props.clearChartData();
    }

    render() {
        const { temp, setPoint, latestPressure, chartData, brewSwitch, pumpDuty, isPreInfusing, pumpOnTime, shotGrams } = this.props;
        const isBrewing = brewSwitch === false; // brewSwitch is false when brewing

        // Determine status label and color
        let statusLabel = "IDLE";
        let statusColor = '#757575'; // Gray for idle
        
        if (isBrewing) {
            if (isPreInfusing) {
                statusLabel = "PRE-INFUSING";
                statusColor = '#FFC107'; // Amber for pre-infusion
            } else {
                statusLabel = "BREWING";
                statusColor = '#4CAF50'; // Green for brewing
            }
        }

        const currentChartOptions = JSON.parse(JSON.stringify(chartOptionsOriginal));
        currentChartOptions.scales.xAxes[0].display = this.state.advancedMode;
        currentChartOptions.scales.yAxes[0].display = this.state.advancedMode;
        currentChartOptions.scales.yAxes[1].display = this.state.advancedMode;
        currentChartOptions.scales.yAxes[2].display = this.state.advancedMode;
        
        // For advanced mode, make sure the chart options also reflect it
        // We're using the pumpDuty axis for shot weight too, so we don't need a separate axis

        return (
            <div className="container">
                <div className="row">
                    <div className="col-3">
                        <div style={{ marginBottom: '10px', textAlign: 'right', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center'}}>
                                <span style={{ fontSize: '0.85rem', color: '#BBBBBB', marginRight: '5px' }}>Advanced</span>
                                <Switch
                                    checked={this.state.advancedMode}
                                    onChange={this.toggleAdvancedMode}
                                    size="small"
                                    sx={{
                                        '& .MuiSwitch-switchBase.Mui-checked': {
                                            color: '#E0E0E0',
                                            '&:hover': {
                                                backgroundColor: 'rgba(224, 224, 224, 0.08)',
                                            },
                                        },
                                        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                                            backgroundColor: '#4CAF50',
                                            opacity: 1,
                                        },
                                        '& .MuiSwitch-switchBase': {
                                            color: '#B0B0B0',
                                        },
                                        '& .MuiSwitch-track': {
                                            backgroundColor: '#424242',
                                            opacity: 1,
                                        },
                                    }}
                                />
                            </div>
                            <Button
                                variant="outlined"
                                onClick={this.handleClearChartData}
                                sx={{
                                    color: '#BBBBBB',
                                    borderColor: '#555555',
                                    textTransform: 'none',
                                    fontSize: '0.85rem',
                                    padding: '4px 10px',
                                    '&:hover': {
                                        borderColor: '#E0E0E0',
                                        backgroundColor: 'rgba(224, 224, 224, 0.08)',
                                        color: '#E0E0E0',
                                    }
                                }}
                            >
                                Clear Chart
                            </Button>
                        </div>
                        <div className="chart-container">
                            <Line ref={this.myRef} options={currentChartOptions} data={chartData}/>
                        </div>
                    </div>
                    <div className="col-1">
                        <div className="card">
                            <div className="control-item">
                                <span className="control-label">Temperature</span>
                                <span className="control-value">{temp.toFixed(2)}°C</span>
                            </div>
                            <div className="control-item">
                                <span className="control-label">Pressure</span>
                                <span className="control-value">
                                    {`${latestPressure.toFixed(2)} bar`}
                                </span>
                            </div>
                            {this.state.advancedMode && this.props.pumpOnTime !== undefined && (
                                <div className="control-item">
                                    <span className="control-label">Pump On Time</span>
                                    <span className="control-value">{this.props.pumpOnTime.toFixed(2)}s</span>
                                </div>
                            )}
                            <div className="control-item">
                                <span className="control-label">Setpoint</span>
                                <span className="control-value">{setPoint.toFixed(2)}°C</span>
                            </div>
                            {this.props.shotGrams !== undefined && (
                                <div className="control-item">
                                    <span className="control-label">Shot Weight</span>
                                    <span className="control-value">{(this.props.shotGrams / 1000).toFixed(1)}g</span>
                                </div>
                            )}
                            {this.state.advancedMode && pumpDuty !== undefined && (
                                <div className="control-item">
                                    <span className="control-label">Pump Duty</span>
                                    <span className="control-value">{pumpDuty}</span>
                                </div>
                            )}
                            <div className="control-item">
                                <span className="control-label">Status</span>
                                <Chip 
                                    label={statusLabel} 
                                    size="small"
                                    sx={{
                                        backgroundColor: statusColor,
                                        color: '#FFFFFF',
                                        fontSize: '0.75rem',
                                        height: '24px',
                                    }}
                                />
                            </div>
                            <div className="control-item-timer-wrapper">
                                <Timer brewSwitch={brewSwitch} autoControl={true} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

export default Espresso;
