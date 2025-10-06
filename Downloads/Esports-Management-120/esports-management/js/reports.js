function generateReport() {
    const reportType = document.getElementById('reportType').value;
    if (!reportType) {
        alert("Please select a report type.");
        return;
    }

    document.getElementById('reportResults').innerHTML = '<div class="loading"></div>';
    document.getElementById('performanceChart').style.display = 'none';

    fetch('http://localhost:3000/api/reports', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reportType })
    })
    .then(res => res.json())
    .then(data => {
        const html = createTableHTML(reportType, data);
        document.getElementById('reportResults').innerHTML = html;
        
        setTimeout(() => {
            const table = document.querySelector('#reportResults table');
            if (table) table.classList.add('table-loaded');
        }, 100);

        if (reportType === 'player' && data.length > 0) {
            const labels = data.map(p => p.username);
            const winRates = data.map(p => p.winRate);
            const colors = winRates.map(rate => {
                if (rate >= 70) return 'rgba(0, 255, 143, 0.8)';
                if (rate >= 45) return 'rgba(0, 242, 255, 0.8)';
                return 'rgba(255, 56, 96, 0.8)';
            });
            drawChart(labels, winRates, colors);
        } else {
            document.getElementById('performanceChart').style.display = 'none';
        }
        
        if (reportType === 'tournament' || reportType === 'match') {
            colorizeStatusCells();
        }
    })
    .catch(error => {
        console.error('Fetch Error:', error);
        document.getElementById('reportResults').innerHTML = `
            <div class="error-message">
                <p>Error loading report: ${error.message}</p>
                <p>Please ensure the backend server is running on port 5000.</p>
            </div>
        `;
    });
}

function createTableHTML(reportType, data) {
    if (data.length === 0) {
        return '<p>No data available for this report type.</p>';
    }

    const headers = Object.keys(data[0]);
    const headerHTML = `<thead><tr>${headers.map(h => `<th>${h.replace(/([A-Z])/g, ' $1').toUpperCase()}</th>`).join('')}</tr></thead>`;
    
    const bodyHTML = `<tbody>${data.map(row => 
        `<tr>${headers.map(header => `<td>${row[header]}</td>`).join('')}</tr>`
    ).join('')}</tbody>`;

    return `<table class="report-table">${headerHTML}${bodyHTML}</table>`;
}

function colorizeStatusCells() {
    document.querySelectorAll('#reportResults tbody tr').forEach(row => {
        // Find the status cell, which is likely the last one
        const statusCell = row.cells[row.cells.length - 1];
        if (!statusCell) return;

        const status = statusCell.innerText.toLowerCase();
        
        if (status.includes('win') || status.includes('completed')) {
            statusCell.style.color = 'var(--success)';
        } else if (status.includes('loss') || status.includes('defeat') || status.includes('cancelled')) {
            statusCell.style.color = 'var(--danger)';
        } else if (status.includes('upcoming') || status.includes('scheduled') || status.includes('pending')) {
            statusCell.style.color = 'var(--warning)';
        }
    });
}

function drawChart(labels, data, colors) {
    const ctx = document.getElementById('performanceChart').getContext('2d');
    document.getElementById('performanceChart').style.display = 'block';

    if (window.myChart) window.myChart.destroy();
    
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(0, 242, 255, 0.6)');
    gradient.addColorStop(1, 'rgba(88, 64, 255, 0.1)');

    window.myChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Win Rate (%)',
                data: data,
                backgroundColor: colors || gradient,
                borderColor: 'rgba(0, 242, 255, 1)',
                borderWidth: 2,
                borderRadius: 8,
                hoverBackgroundColor: 'rgba(255, 0, 228, 0.7)',
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    labels: {
                        color: '#ffffff',
                        font: {
                            family: "'Rajdhani', sans-serif",
                            size: 14
                        }
                    }
                },
                title: {
                    display: true,
                    text: 'PLAYER PERFORMANCE ANALYSIS',
                    color: '#00f2ff',
                    font: {
                        family: "'Orbitron', sans-serif",
                        size: 16,
                        weight: 'bold'
                    },
                    padding: {
                        bottom: 20
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    },
                    ticks: {
                        color: '#a0a0c0',
                        font: {
                            family: "'Rajdhani', sans-serif"
                        }
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    },
                    ticks: {
                        color: '#a0a0c0',
                        font: {
                            family: "'Rajdhani', sans-serif"
                        }
                    }
                }
            },
            animation: {
                duration: 1500,
                easing: 'easeOutQuart'
            }
        }
    });
    
    setTimeout(() => {
        document.getElementById('performanceChart').classList.add('chart-loaded');
    }, 100);
}

document.addEventListener('DOMContentLoaded', function() {
    document.addEventListener('keydown', function(e) {
        if (e.altKey && e.key === 'g') {
            generateReport();
        }
    });
    
    document.querySelector('.report-container').classList.add('fade-in');
});