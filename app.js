const workspace = document.querySelector('#workspace');
const title = document.querySelector('#tool-title');
const help = document.querySelector('#tool-help');
const input = document.querySelector('#file-input');
const processButton = document.querySelector('#process-button');
const status = document.querySelector('#status');
const downloadLink = document.querySelector('#download-link');

let selectedTool = '';
let currentDownloadUrl = null;

const tools = {
  merge: {
    title: 'Merge PDF',
    help: 'Kam az kam 2 PDF files select karein.',
    accept: '.pdf,application/pdf',
    multiple: true
  },
  split: {
    title: 'Split PDF',
    help: 'Page range likhein, misal: 1-3 ya 1,3,5.',
    accept: '.pdf,application/pdf'
  },
  compress: {
    title: 'Compress PDF',
    help: 'PDF ko optimize karne ki koshish hogi. Size kam hona guaranteed nahi.',
    accept: '.pdf,application/pdf'
  },
  rotate: {
    title: 'Rotate PDF',
    help: 'Har page ko 90 degree clockwise rotate karein.',
    accept: '.pdf,application/pdf'
  },
  jpg: {
    title: 'JPG to PDF',
    help: 'JPG, JPEG ya PNG images select karein.',
    accept: 'image/jpeg,image/png,.jpg,.jpeg,.png',
    multiple: true
  },
  pages: {
    title: 'Page numbers',
    help: 'Har page ke neeche page number add hoga.',
    accept: '.pdf,application/pdf'
  },
  watermark: {
    title: 'Watermark',
    help: 'PDF ke har page par apna watermark text lagayein.',
    accept: '.pdf,application/pdf'
  }
};

// Extra controls for page range and watermark text.
const options = document.createElement('div');
options.id = 'tool-options';
options.style.cssText =
  'display:grid;gap:8px;margin:14px 0;max-width:100%;';

input.insertAdjacentElement('beforebegin', options);

function addOption(labelText, id, placeholder, value = '') {
  const label = document.createElement('label');
  label.htmlFor = id;
  label.textContent = labelText;
  label.style.cssText = 'font-size:14px;font-weight:600;';

  const field = document.createElement('input');
  field.id = id;
  field.type = 'text';
  field.placeholder = placeholder;
  field.value = value;
  field.style.cssText =
    'padding:12px;border:1px solid #ccd2df;border-radius:8px;' +
    'font:inherit;width:100%;box-sizing:border-box;';

  options.append(label, field);
}

function clearDownload() {
  if (currentDownloadUrl) {
    URL.revokeObjectURL(currentDownloadUrl);
    currentDownloadUrl = null;
  }
  downloadLink.removeAttribute('href');
  downloadLink.hidden = true;
}

function showTool(key) {
  selectedTool = key;
  const config = tools[key];

  title.textContent = config.title;
  help.textContent = config.help;
  input.accept = config.accept;
  input.multiple = Boolean(config.multiple);

  input.value = '';
  options.replaceChildren();
  clearDownload();
  status.textContent = '';

  if (key === 'split') {
    addOption('Pages to extract', 'page-range', 'Example: 1-3,5');
  }

  if (key === 'watermark') {
    addOption('Watermark text', 'watermark-text', 'Example: FREE COPY', 'FREE COPY');
  }

  processButton.textContent = 'Process files';
  workspace.hidden = false;
  workspace.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

document.querySelectorAll('.tool').forEach(button => {
  button.addEventListener('click', () => {
    showTool(button.dataset.tool);
  });
});

// Add a Watermark tool card if it is not already in index.html.
if (!document.querySelector('[data-tool="watermark"]')) {
  const grid = document.querySelector('.tools-grid');
  if (grid) {
    const button = document.createElement('button');
    button.className = 'tool';
    button.dataset.tool = 'watermark';
    button.innerHTML =
      '<span class="tool-icon">T</span>' +
      '<strong>Watermark</strong>' +
      '<small>Add text to PDF pages</small>';
    button.addEventListener('click', () => showTool('watermark'));
    grid.appendChild(button);
  }
}

function parsePageRange(text, totalPages) {
  if (!text.trim()) {
    throw new Error('Page range likhein, misal 1-3,5.');
  }

  const selected = new Set();

  for (const part of text.split(',')) {
    const item = part.trim();
    const match = item.match(/^(\d+)(?:\s*-\s*(\d+))?$/);

    if (!match) {
      throw new Error('Page range ka format ghalat hai. Misal: 1-3,5.');
    }

    const start = Number(match[1]);
    const end = match[2] ? Number(match[2]) : start;

    if (
      start < 1 ||
      end < start ||
      end > totalPages
    ) {
      throw new Error(`Pages 1 se ${totalPages} ke darmiyan honi chahiye.`);
    }

    for (let page = start; page <= end; page++) {
      selected.add(page - 1);
    }
  }

  return [...selected].sort((a, b) => a - b);
}

async function loadPdf(file) {
  try {
    return await PDFLib.PDFDocument.load(await file.arrayBuffer());
  } catch {
    throw new Error(
      `"${file.name}" open nahi hui. Check karein ke PDF valid aur password-protected na ho.`
    );
  }
}

processButton.addEventListener('click', async () => {
  const files = [...input.files];

  clearDownload();
  status.textContent = '';

  if (!selectedTool) {
    status.textContent = 'Pehle koi tool select karein.';
    return;
  }

  if (!files.length) {
    status.textContent = 'Pehle apni file select karein.';
    return;
  }

  if (!window.PDFLib) {
    status.textContent =
      'PDF library load nahi hui. Internet connection check karein.';
    return;
  }

  if (selectedTool === 'merge' && files.length < 2) {
    status.textContent = 'Merge ke liye kam az kam 2 PDF files chahiye.';
    return;
  }

  processButton.disabled = true;
  processButton.textContent = 'Processing...';

  try {
    const {
      PDFDocument,
      degrees,
      StandardFonts,
      rgb
    } = PDFLib;

    let resultBytes;
    let outputName = `${selectedTool}-result.pdf`;

    if (selectedTool === 'jpg') {
      const pdf = await PDFDocument.create();

      for (const file of files) {
        const bytes = await file.arrayBuffer();
        let image;

        if (
          file.type === 'image/png' ||
          /\.png$/i.test(file.name)
        ) {
          image = await pdf.embedPng(bytes);
        } else if (
          file.type === 'image/jpeg' ||
          /\.jpe?g$/i.test(file.name)
        ) {
          image = await pdf.embedJpg(bytes);
        } else {
          throw new Error(`Unsupported image: ${file.name}. JPG ya PNG use karein.`);
        }

        const page = pdf.addPage([image.width, image.height]);
        page.drawImage(image, {
          x: 0,
          y: 0,
          width: image.width,
          height: image.height
        });
      }

      resultBytes = await pdf.save({ useObjectStreams: true });
      outputName = 'images-to-pdf.pdf';

    } else {
      const docs = await Promise.all(files.map(loadPdf));

      if (selectedTool === 'merge') {
        const merged = await PDFDocument.create();

        for (const doc of docs) {
          const copiedPages = await merged.copyPages(
            doc,
            doc.getPageIndices()
          );
          copiedPages.forEach(page => merged.addPage(page));
        }

        resultBytes = await merged.save({ useObjectStreams: true });

      } else {
        const doc = docs[0];
        const pages = doc.getPages();

        if (selectedTool === 'split') {
          const range = document.querySelector('#page-range').value;
          const indexes = parsePageRange(range, pages.length);
          const output = await PDFDocument.create();
          const copiedPages = await output.copyPages(doc, indexes);

          copiedPages.forEach(page => output.addPage(page));
          resultBytes = await output.save({ useObjectStreams: true });
          outputName = 'split-pages.pdf';

        } else if (selectedTool === 'rotate') {
          pages.forEach(page => {
            const current = page.getRotation().angle;
            page.setRotation(degrees((current + 90) % 360));
          });

          resultBytes = await doc.save({ useObjectStreams: true });

        } else if (selectedTool === 'pages') {
          const font = await doc.embedFont(StandardFonts.Helvetica);

          pages.forEach((page, index) => {
            const { width } = page.getSize();
            const label = `${index + 1}`;
            const fontSize = 10;
            const textWidth = font.widthOfTextAtSize(label, fontSize);

            page.drawText(label, {
              x: Math.max(8, (width - textWidth) / 2),
              y: 18,
              size: fontSize,
              font,
              color: rgb(0.3, 0.3, 0.3)
            });
          });

          resultBytes = await doc.save({ useObjectStreams: true });
          outputName = 'numbered-pages.pdf';

        } else if (selectedTool === 'watermark') {
          const text = document.querySelector('#watermark-text').value.trim();

          if (!text) {
            throw new Error('Watermark text khaali nahi ho sakta.');
          }

          const font = await doc.embedFont(StandardFonts.HelveticaBold);

          pages.forEach(page => {
            const { width, height } = page.getSize();
            const fontSize = Math.max(18, Math.min(width, height) / 12);
            const textWidth = font.widthOfTextAtSize(text, fontSize);

            page.drawText(text, {
              x: Math.max(8, (width - textWidth) / 2),
              y: height / 2,
              size: fontSize,
              font,
              color: rgb(0.65, 0.65, 0.65),
              opacity: 0.28,
              rotate: degrees(35)
            });
          });

          resultBytes = await doc.save({ useObjectStreams: true });
          outputName = 'watermarked.pdf';

        } else if (selectedTool === 'compress') {
          // pdf-lib can optimize object streams, but it does not
          // downsample or recompress existing embedded images.
          resultBytes = await doc.save({ useObjectStreams: true });
          outputName = 'optimized.pdf';

        } else {
          throw new Error('Ye tool abhi available nahi hai.');
        }
      }
    }

    const blob = new Blob([resultBytes], { type: 'application/pdf' });
    currentDownloadUrl = URL.createObjectURL(blob);

    downloadLink.href = currentDownloadUrl;
    downloadLink.download = outputName;
    downloadLink.textContent = `Download ${outputName}`;
    downloadLink.hidden = false;

    if (selectedTool === 'compress') {
      const before = files[0].size;
      const after = blob.size;
      const difference = before - after;

      if (difference > 0) {
        const percent = ((difference / before) * 100).toFixed(1);
        status.textContent =
          `Optimization complete. File ${percent}% chhoti hui. Download check karein.`;
      } else {
        status.textContent =
          'PDF optimize hui, lekin size kam nahi hua. Is tool se image recompression nahi hoti.';
      }
    } else {
      status.textContent =
        'File tayyar hai. Download link par tap karein.';
    }

  } catch (error) {
    status.textContent =
      error.message || 'Processing fail hui. Doosri PDF file try karein.';
  } finally {
    processButton.disabled = false;
    processButton.textContent = 'Process files';
  }
});

// Release the temporary download URL when the page is closed or refreshed.
window.addEventListener('pagehide', clearDownload);
