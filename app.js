const workspace = document.querySelector('#workspace');
const title = document.querySelector('#tool-title');
const help = document.querySelector('#tool-help');
const input = document.querySelector('#file-input');
const processButton = document.querySelector('#process-button');
const status = document.querySelector('#status');
const downloadLink = document.querySelector('#download-link');

let selectedTool = '';

const tools = {
  merge: ['Merge PDF', 'Select two or more PDF files.'],
  split: ['Split PDF', 'Select a PDF. Page extraction will be added next.'],
  compress: ['Compress PDF', 'Select a PDF. Compression will be added next.'],
  rotate: ['Rotate PDF', 'Select a PDF to rotate all pages.'],
  jpg: ['JPG to PDF', 'Select one or more JPG or PNG images.'],
  pages: ['Page numbers', 'Select a PDF to add page numbers.']
};

document.querySelectorAll('.tool').forEach(button => {
  button.addEventListener('click', () => {
    selectedTool = button.dataset.tool;
    title.textContent = tools[selectedTool][0];
    help.textContent = tools[selectedTool][1];
    input.accept = selectedTool === 'jpg'
      ? 'image/jpeg,image/png,.jpg,.jpeg,.png'
      : '.pdf,application/pdf';
    input.multiple = ['merge', 'jpg'].includes(selectedTool);
    processButton.textContent = 'Process files';
    status.textContent = '';
    downloadLink.hidden = true;
    workspace.hidden = false;
    workspace.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

processButton.addEventListener('click', async () => {
  const files = [...input.files];
  status.textContent = '';
  downloadLink.hidden = true;

  if (!selectedTool) {
    status.textContent = 'Please select a tool first.';
    return;
  }
  if (!files.length) {
    status.textContent = 'Please choose your file first.';
    return;
  }

  if (!window.PDFLib) {
    status.textContent = 'PDF library load nahi hui. Internet connection check karein.';
    return;
  }

  processButton.disabled = true;
  try {
    const { PDFDocument, degrees, StandardFonts, rgb } = PDFLib;
    let output;

    if (selectedTool === 'jpg') {
      const pdf = await PDFDocument.create();
      for (const file of files) {
        const bytes = await file.arrayBuffer();
        const image = file.type === 'image/png'
          ? await pdf.embedPng(bytes)
          : await pdf.embedJpg(bytes);
        const page = pdf.addPage([image.width, image.height]);
        page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
      }
      output = await pdf.save();
    } else {
      const docs = await Promise.all(files.map(async file =>
        PDFDocument.load(await file.arrayBuffer())
      ));

      if (selectedTool === 'merge') {
        if (docs.length < 2) throw new Error('Merge ke liye kam az kam 2 PDF files select karein.');
        const merged = await PDFDocument.create();
        for (const doc of docs) {
          const pages = await merged.copyPages(doc, doc.getPageIndices());
          pages.forEach(page => merged.addPage(page));
        }
        output = await merged.save();
      } else if (selectedTool === 'rotate') {
        const doc = docs[0];
        doc.getPages().forEach(page => {
          const current = page.getRotation().angle;
          page.setRotation(degrees((current + 90) % 360));
        });
        output = await doc.save();
      } else if (selectedTool === 'pages') {
        const doc = docs[0];
        const font = await doc.embedFont(StandardFonts.Helvetica);
        doc.getPages().forEach((page, index) => {
          const { width } = page.getSize();
          page.drawText(String(index + 1), {
            x: width / 2 - 4, y: 18, size: 10,
            font, color: rgb(0.35, 0.35, 0.35)
          });
        });
        output = await doc.save();
      } else {
        throw new Error('Ye tool aglay step mein implement hoga.');
      }
    }

    const blob = new Blob([output], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    downloadLink.href = url;
    downloadLink.download = selectedTool + '-result.pdf';
    downloadLink.textContent = 'Download ' + selectedTool + ' result';
    downloadLink.hidden = false;
    status.textContent = 'File tayyar hai. Download link par tap karein.';
  } catch (error) {
    status.textContent = error.message || 'Processing nahi ho saki. File check karein.';
  } finally {
    processButton.disabled = false;
  }
});
