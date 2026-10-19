let chart = null;

export function renderWaveform(samples) {
  const canvas = document.getElementById("ecg-chart");
  const empty = document.getElementById("wave-empty");
  if (!canvas || !window.Chart) return;

  empty.hidden = true;
  if (chart) chart.destroy();

  const labels = samples.map((_, i) => i);
  chart = new Chart(canvas.getContext("2d"), {
    type: "line",
    data: {
      labels,
      datasets: [{
        data: samples,
        borderColor: "#5de4ff",
        borderWidth: 1.8,
        pointRadius: 0,
        pointHoverRadius: 3,
        tension: 0.12,
        fill: false,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 850, easing: "easeOutQuart" },
      interaction: { intersect: false, mode: "index" },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "rgba(4,13,20,.94)",
          borderColor: "rgba(93,228,255,.22)",
          borderWidth: 1,
          titleFont: { family: "JetBrains Mono", size: 9 },
          bodyFont: { family: "JetBrains Mono", size: 10 },
          callbacks: { title: items => `SAMPLE ${String(items[0].dataIndex).padStart(3, "0")}` }
        }
      },
      scales: {
        x: {
          grid: { color: "rgba(126,205,227,.045)" },
          ticks: { color: "#526f7a", maxTicksLimit: 9, font: { family: "JetBrains Mono", size: 8 } },
          title: { display: true, text: "SAMPLE INDEX", color: "#526f7a", font: { family: "JetBrains Mono", size: 8 } }
        },
        y: {
          grid: { color: "rgba(126,205,227,.06)" },
          ticks: { color: "#526f7a", font: { family: "JetBrains Mono", size: 8 } },
          title: { display: true, text: "AMPLITUDE", color: "#526f7a", font: { family: "JetBrains Mono", size: 8 } }
        }
      }
    }
  });
}
