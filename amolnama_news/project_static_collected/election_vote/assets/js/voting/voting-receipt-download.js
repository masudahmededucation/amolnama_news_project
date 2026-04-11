/* ========== Election Vote – Receipt Download as JPG ==========
   NOTE: Canvas2D fillStyle/strokeStyle require literal color strings
   (CSS custom properties are not supported by the Canvas API). The
   hex colors below are an intentional exception to the project's
   "no hardcoded hex colors" rule, limited to canvas rendering. */

/**
 * Download the vote receipt as a JPG image.
 * Draws receipt content onto a canvas and triggers a file download.
 */
function downloadReceiptAsImage() {
  const receiptCode = document.getElementById('receipt-code').textContent || '';
  const electionName = selectedElection ? selectedElection.nameBn : '';
  const constituencyName = selectedConstituency
    ? selectedConstituency.nameBn + ' (' + selectedConstituency.nameEn + ')'
    : '';
  const partyName = selectedParty ? selectedParty.nameBn : '';

  const canvas = document.createElement('canvas');
  const canvasContext = canvas.getContext('2d');

  // Canvas dimensions
  const width = 600;
  const height = 480;
  canvas.width = width;
  canvas.height = height;

  // Background
  canvasContext.fillStyle = '#ffffff';
  canvasContext.fillRect(0, 0, width, height);

  // Border
  canvasContext.strokeStyle = '#dee2e6';
  canvasContext.lineWidth = 2;
  canvasContext.strokeRect(10, 10, width - 20, height - 20);

  // Title
  canvasContext.fillStyle = '#28a745';
  canvasContext.font = 'bold 20px Arial, sans-serif';
  canvasContext.textAlign = 'center';
  canvasContext.fillText('Vote Cast Successfully', width / 2, 55);
  canvasContext.font = '18px Arial, sans-serif';
  canvasContext.fillText('\u09AD\u09CB\u099F \u09B8\u09AB\u09B2\u09AD\u09BE\u09AC\u09C7 \u09AA\u09CD\u09B0\u09A6\u09BE\u09A8 \u0995\u09B0\u09BE \u09B9\u09AF\u09BC\u09C7\u099B\u09C7', width / 2, 80);

  // Divider
  canvasContext.strokeStyle = '#dee2e6';
  canvasContext.lineWidth = 1;
  canvasContext.beginPath();
  canvasContext.moveTo(40, 100);
  canvasContext.lineTo(width - 40, 100);
  canvasContext.stroke();

  // Receipt code label
  canvasContext.fillStyle = '#6c757d';
  canvasContext.font = '14px Arial, sans-serif';
  canvasContext.fillText('Audit Receipt Code / \u0985\u09A1\u09BF\u099F \u09B0\u09B8\u09BF\u09A6 \u0995\u09CB\u09A1', width / 2, 130);

  // Dashed box around receipt code
  canvasContext.setLineDash([6, 4]);
  canvasContext.strokeStyle = '#adb5bd';
  canvasContext.strokeRect(120, 145, width - 240, 55);
  canvasContext.setLineDash([]);

  // Receipt code
  canvasContext.fillStyle = '#212529';
  canvasContext.font = 'bold 28px Courier New, monospace';
  canvasContext.fillText(receiptCode, width / 2, 182);

  // Divider
  canvasContext.strokeStyle = '#dee2e6';
  canvasContext.beginPath();
  canvasContext.moveTo(40, 220);
  canvasContext.lineTo(width - 40, 220);
  canvasContext.stroke();

  // Summary section
  canvasContext.textAlign = 'left';
  canvasContext.font = 'bold 14px Arial, sans-serif';
  canvasContext.fillStyle = '#495057';
  let summaryY = 250;

  canvasContext.fillText('Election:', 60, summaryY);
  canvasContext.font = '14px Arial, sans-serif';
  canvasContext.fillStyle = '#212529';
  canvasContext.fillText(electionName, 160, summaryY);

  summaryY += 35;
  canvasContext.font = 'bold 14px Arial, sans-serif';
  canvasContext.fillStyle = '#495057';
  canvasContext.fillText('Constituency:', 60, summaryY);
  canvasContext.font = '14px Arial, sans-serif';
  canvasContext.fillStyle = '#212529';
  canvasContext.fillText(constituencyName, 160, summaryY);

  summaryY += 35;
  canvasContext.font = 'bold 14px Arial, sans-serif';
  canvasContext.fillStyle = '#495057';
  canvasContext.fillText('Party:', 60, summaryY);
  canvasContext.font = '14px Arial, sans-serif';
  canvasContext.fillStyle = '#212529';
  canvasContext.fillText(partyName, 160, summaryY);

  // Divider
  canvasContext.strokeStyle = '#dee2e6';
  canvasContext.beginPath();
  canvasContext.moveTo(40, summaryY + 30);
  canvasContext.lineTo(width - 40, summaryY + 30);
  canvasContext.stroke();

  // Footer note
  canvasContext.textAlign = 'center';
  canvasContext.fillStyle = '#6c757d';
  canvasContext.font = '12px Arial, sans-serif';
  canvasContext.fillText('Please save this code for your records.', width / 2, summaryY + 60);
  canvasContext.fillText('\u09A6\u09AF\u09BC\u09BE \u0995\u09B0\u09C7 \u098F\u0987 \u0995\u09CB\u09A1\u099F\u09BF \u0986\u09AA\u09A8\u09BE\u09B0 \u09B0\u09C7\u0995\u09B0\u09CD\u09A1\u09C7\u09B0 \u099C\u09A8\u09CD\u09AF \u09B8\u0982\u09B0\u0995\u09CD\u09B7\u09A3 \u0995\u09B0\u09C1\u09A8\u0964', width / 2, summaryY + 80);

  // Timestamp
  const now = new Date();
  const timestamp = now.toLocaleDateString('en-GB') + ' ' + now.toLocaleTimeString('en-GB');
  canvasContext.fillStyle = '#adb5bd';
  canvasContext.font = '11px Arial, sans-serif';
  canvasContext.fillText(timestamp, width / 2, height - 25);

  // Download
  const link = document.createElement('a');
  link.download = 'vote-receipt-' + receiptCode + '.jpg';
  link.href = canvas.toDataURL('image/jpeg', 0.95);
  link.click();
}
