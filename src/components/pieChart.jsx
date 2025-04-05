import React from 'react';
import ReactApexChart from 'react-apexcharts';
import './visualizations.css';

export default function PieChart({ items = [], totals = [], showNumVotes = true }) {
  // Filter out items with 0 votes
  const filteredData = items.map((item, index) => ({
    item,
    total: totals[index] || 0
  })).filter(data => data.total > 0);
  
  // Extract the filtered items and totals
  const filteredItems = filteredData.map(d => d.item);
  const filteredTotals = filteredData.map(d => d.total);
  
  // Calculate percentages for the labels
  const sum = filteredTotals.reduce((acc, val) => acc + val, 0);
  const percentages = filteredTotals.map(val => ((val / sum) * 100).toFixed(1));
  
  const chartOptions = {
    chart: {
      type: 'pie',
      toolbar: {
        show: false
      }
    },
    labels: filteredItems,
    tooltip: {
      enabled: true,
      y: {
        formatter: function(value, { seriesIndex }) {
          return showNumVotes 
            ? `${value} votes (${percentages[seriesIndex]}%)` 
            : `${percentages[seriesIndex]}%`;
        }
      }
    },
    legend: {
      position: 'bottom',
      fontSize: '14px',
      markers: {
        width: 12,
        height: 12,
        radius: 6
      },
      itemMargin: {
        horizontal: 15,
        vertical: 5
      }
    },
    dataLabels: {
      enabled: showNumVotes,
      formatter: function(val, { seriesIndex }) {
        return showNumVotes ? filteredTotals[seriesIndex] : '';
      },
      style: {
        fontSize: '16px',
        fontWeight: 'bold',
        fontFamily: 'inherit'
      }
    },
    plotOptions: {
      pie: {
        expandOnClick: false,
        donut: {
          size: '0%'
        }
      }
    },
    colors: [
      '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe',
      '#1d4ed8', '#3b5cf6', '#818cf8', '#a5b4fc', '#c7d2fe',
      '#1e40af', '#4f46e5', '#4338ca', '#3730a3', '#312e81'
    ],
    states: {
      hover: {
        filter: {
          type: 'darken',
          value: 0.15
        }
      },
      active: {
        filter: {
          type: 'darken',
          value: 0.2
        }
      }
    },
    stroke: {
      width: 2,
      colors: ['#fff']
    },
    responsive: [{
      breakpoint: 480,
      options: {
        chart: {
          width: 320
        },
        legend: {
          position: 'bottom'
        }
      }
    }]
  };

  return (
    <div className="pie-chart-container">
      <ReactApexChart 
        options={chartOptions} 
        series={filteredTotals.length > 0 ? filteredTotals : [1]} 
        type="pie" 
        height={400} 
      />
    </div>
  );
}