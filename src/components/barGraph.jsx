import React from 'react';
import ReactApexChart from 'react-apexcharts';

export default function BarGraph({ items = [], totals = [] }) {

  const setFontSize = () => {
    if (items.length < 7) {
      return 24
    }
    return 12
  }

  const setGraphHeight = () => {
    if (items.length < 7) {
      return 250
    }
    if (items.length > 15) {
      return items.length * 30
    }
    return 350
  }
  
  // Generate colors based on position - blue gradient
  const getColors = () => {
    // Blue gradient colors (from darkest to lightest)
    const blueGradients = [
      '#0a2463', // Very dark blue
      '#1e40af', // Dark blue
      '#3b82f6', // Medium blue
      '#60a5fa', // Light blue
      '#93c5fd'  // Very light blue
    ];
    
    // Default color for remaining items
    const defaultColor = '#dbeafe'; // Lightest blue
    
    // Create an array with colors based on position
    return items.map((_, index) => {
      return index < blueGradients.length ? blueGradients[index] : defaultColor;
    });
  };

  const graph = {
    series: [{
      data: totals,
      name: 'Votes'
    }],
    options: {
      chart: {
        type: 'bar',
        height: setGraphHeight(),
        toolbar: {
          show: false
        }
      },
      colors: getColors(),
      tooltip: {
        enabled: true,
        y: {
          title: {
            formatter: () => 'Votes'
          }
        }
      },
      plotOptions: {
        bar: {
          borderRadius: 4,
          borderRadiusApplication: 'end',
          horizontal: true,
          distributed: true,  // Enable distributed to apply custom colors
          dataLabels: {
            position: 'center'
          }
        }
      },
      dataLabels: {
        enabled: true,
        style: {
          fontSize: setFontSize(),
          colors: ['#fff']
        },
        formatter: function(val) {
          return val;
        }
      },
      legend: {
        show: false
      },
      xaxis: {
        categories: items,
        labels: {
          show: false
        }
      },
      yaxis: {
        labels: {
          show: true,
          style: {
            fontSize: setFontSize()
          }
        }
      }
    },
  }


  return (<div>
    <ReactApexChart options={graph.options} series={graph.series} type='bar' height={graph.options.chart.height} />
  </div>
  )
}
