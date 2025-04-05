import React from 'react';
import ReactApexChart from 'react-apexcharts';
import './visualizations.css';

export default function BarGraph({ items = [], totals = [], showNumVotes = true }) {
  const graph = {
    series: [{
      name: 'Votes',
      data: totals
    }],
    options: {
      chart: {
        type: 'bar',
        height: 100,
        toolbar: {
          show: false
        }
      },
      tooltip: {
        enabled: true,
        y: {
          formatter: function(value) {
            return value + ' votes';
          }
        }
      },
      plotOptions: {
        bar: {
          borderRadius: 6,
          borderRadiusApplication: 'end',
          horizontal: true,
          barHeight: '70%',
          distributed: true,
          dataLabels: {
            position: 'center',
          },
        }
      },
      dataLabels: {
        enabled: showNumVotes, // Only show the vote counts if showNumVotes is true
        style: {
          colors: ['#fff'],
          fontSize: '16px',
          fontWeight: 'bold',
          fontFamily: 'inherit'
        },
        formatter: function(val) {
          return showNumVotes ? val : '';
        }
      },
      colors: [
        '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe',
        '#1d4ed8', '#3b5cf6', '#818cf8', '#a5b4fc', '#c7d2fe',
        '#1e40af', '#4f46e5', '#4338ca', '#3730a3', '#312e81'
      ],
      xaxis: {
        categories: items,
        labels: {
          show: false
        },
        axisBorder: {
          show: false
        },
        axisTicks: {
          show: false
        }
      },
      yaxis: {
        labels: {
          show: true,
          style: {
            fontSize: '16px',
            fontFamily: 'inherit'
          }
        }
      },
      grid: {
        show: false
      },
      states: {
        hover: {
          filter: {
            type: 'darken',
            value: 0.1
          }
        }
      }
    },
  }

  return (
    <div className="bar-graph-container">
      <ReactApexChart 
        options={graph.options} 
        series={graph.series} 
        type='bar' 
        height={Math.max(250, items.length * 50)} 
      />
    </div>
  )
}
