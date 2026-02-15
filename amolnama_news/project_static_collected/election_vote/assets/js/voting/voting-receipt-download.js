/* ========== Election Vote – Receipt Download as JPG ========== */

/**
 * Download the vote receipt as a JPG image.
 * Draws receipt content onto a canvas and triggers a file download.
 */
function downloadReceiptAsImage() {
  var receiptCode = document.getElementById('receipt-code').textContent || '';
  var electionName = selectedElection ? selectedElection.nameBn : '';
  var constituencyName = selectedConstituency
    ? selectedConstituency.nameBn + ' (' + selectedConstituency.nameEn + ')'
    : '';
  var partyName = selectedParty ? selectedParty.nameBn : '';

  var canvas = document.createElement('canvas');
  var ctx = canvas.getContext('2d');

  // Canvas dimensions
  var width = 600;
  var height = 480;
  canvas.width = width;
  canvas.height = height;

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // Border
  ctx.strokeStyle = '#dee2e6';
  ctx.lineWidth = 2;
  ctx.strokeRect(10, 10, width - 20, height - 20);

  // Title
  ctx.fillStyle = '#28a745';
  ctx.font = 'bold 20px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Vote Cast Successfully', width / 2, 55);
  ctx.font = '18px Arial, sans-serif';
  ctx.fillText('\u09AD\u09CB\u099F \u09B8\u09AB\u09B2\u09AD\u09BE\u09AC\u09C7 \u09AA\u09CD\u09B0\u09A6\u09BE\u09A8 \u0995\u09B0\u09BE \u09B9\u09AF\u09BC\u09C7\u099B\u09C7', width / 2, 80);

  // Divider
  ctx.strokeStyle = '#dee2e6';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(40, 100);
  ctx.lineTo(width - 40, 100);
  ctx.stroke();

  // Receipt code label
  ctx.fillStyle = '#6c757d';
  ctx.font = '14px Arial, sans-serif';
  ctx.fillText('Audit Receipt Code / \u0985\u09A1\u09BF\u099F \u09B0\u09B8\u09BF\u09A6 \u0995\u09CB\u09A1', width / 2, 130);

  // Dashed box around receipt code
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = '#adb5bd';
  ctx.strokeRect(120, 145, width - 240, 55);
  ctx.setLineDash([]);

  // Receipt code
  ctx.fillStyle = '#212529';
  ctx.font = 'bold 28px Courier New, monospace';
  ctx.fillText(receiptCode, width / 2, 182);

  // Divider
  ctx.strokeStyle = '#dee2e6';
  ctx.beginPath();
  ctx.moveTo(40, 220);
  ctx.lineTo(width - 40, 220);
  ctx.stroke();

  // Summary section
  ctx.textAlign = 'left';
  ctx.font = 'bold 14px Arial, sans-serif';
  ctx.fillStyle = '#495057';
  var summaryY = 250;

  ctx.fillText('Election:', 60, summaryY);
  ctx.font = '14px Arial, sans-serif';
  ctx.fillStyle = '#212529';
  ctx.fillText(electionName, 160, summaryY);

  summaryY += 35;
  ctx.font = 'bold 14px Arial, sans-serif';
  ctx.fillStyle = '#495057';
  ctx.fillText('Constituency:', 60, summaryY);
  ctx.font = '14px Arial, sans-serif';
  ctx.fillStyle = '#212529';
  ctx.fillText(constituencyName, 160, summaryY);

  summaryY += 35;
  ctx.font = 'bold 14px Arial, sans-serif';
  ctx.fillStyle = '#495057';
  ctx.fillText('Party:', 60, summaryY);
  ctx.font = '14px Arial, sans-serif';
  ctx.fillStyle = '#212529';
  ctx.fillText(partyName, 160, summaryY);

  // Divider
  ctx.strokeStyle = '#dee2e6';
  ctx.beginPath();
  ctx.moveTo(40, summaryY + 30);
  ctx.lineTo(width - 40, summaryY + 30);
  ctx.stroke();

  // Footer note
  ctx.textAlign = 'center';
  ctx.fillStyle = '#6c757d';
  ctx.font = '12px Arial, sans-serif';
  ctx.fillText('Please save this code for your records.', width / 2, summaryY + 60);
  ctx.fillText('\u09A6\u09AF\u09BC\u09BE \u0995\u09B0\u09C7 \u098F\u0987 \u0995\u09CB\u09A1\u099F\u09BF \u0986\u09AA\u09A8\u09BE\u09B0 \u09B0\u09C7\u0995\u09B0\u09CD\u09A1\u09C7\u09B0 \u099C\u09A8\u09CD\u09AF \u09B8\u0982\u09B0\u0995\u09CD\u09B7\u09A3 \u0995\u09B0\u09C1\u09A8\u0964', width / 2, summaryY + 80);

  // Timestamp
  var now = new Date();
  var timestamp = now.toLocaleDateString('en-GB') + ' ' + now.toLocaleTimeString('en-GB');
  ctx.fillStyle = '#adb5bd';
  ctx.font = '11px Arial, sans-serif';
  ctx.fillText(timestamp, width / 2, height - 25);

  // Download
  var link = document.createElement('a');
  link.download = 'vote-receipt-' + receiptCode + '.jpg';
  link.href = canvas.toDataURL('image/jpeg', 0.95);
  link.click();
}
