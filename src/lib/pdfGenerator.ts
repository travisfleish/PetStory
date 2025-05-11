import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

interface StoryPage {
  text: string;
}

interface Story {
  title: string;
  pages: StoryPage[];
}

interface BookOptions {
  pageSize?: string;
  orientation?: string;
  margin?: number;
  fontName?: string;
  titleFontSize?: number;
  textFontSize?: number;
  coverBackground?: string;
  pageBackground?: string;
}

/**
 * Generate a PDF storybook
 */
export const generateStorybook = async (
  storyData: Story,
  images: string[],
  bookOptions: BookOptions = {}
): Promise<Blob> => {
  const {
    pageSize = 'a5',
    orientation = 'portrait',
    margin = 15,
    fontName = 'helvetica',
    titleFontSize = 24,
    textFontSize = 12,
    coverBackground = '#f0f9ff', // Light blue
    pageBackground = '#ffffff'
  } = bookOptions;

  // Create a new PDF document
  const doc = new jsPDF({
    orientation: orientation,
    unit: 'mm',
    format: pageSize
  });

  // Get page dimensions
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - (margin * 2);

  // Load the main font
  doc.setFont(fontName);

  // Cover page
  doc.setFillColor(hexToRgb(coverBackground).r, hexToRgb(coverBackground).g, hexToRgb(coverBackground).b);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  // Add first image as cover image if available
  if (images && images.length > 0) {
    try {
      const coverImageData = images[0];
      const img = await loadImage(coverImageData);

      // Calculate dimensions to fit the image within the page while maintaining aspect ratio
      const imgRatio = img.height / img.width;
      let imgWidth = contentWidth;
      let imgHeight = imgWidth * imgRatio;

      // If image is too tall, scale it down
      if (imgHeight > pageHeight * 0.6) {
        imgHeight = pageHeight * 0.6;
        imgWidth = imgHeight / imgRatio;
      }

      // Center the image horizontally
      const imgX = (pageWidth - imgWidth) / 2;
      const imgY = margin + 10;

      doc.addImage(img, 'JPEG', imgX, imgY, imgWidth, imgHeight);
    } catch (error) {
      console.error("Error adding cover image:", error);
      // Continue without cover image
    }
  }

  // Add title
  doc.setFontSize(titleFontSize);
  doc.setTextColor(0, 0, 0);

  const titleLines = doc.splitTextToSize(storyData.title, contentWidth);
  let yPosition = pageHeight * 0.75;

  titleLines.forEach(line => {
    doc.text(line, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += titleFontSize / 2;
  });

  // Add pages
  for (let i = 0; i < storyData.pages.length; i++) {
    // Skip if no image or text
    if (!images[i + 1] && !storyData.pages[i].text) continue;

    // Add a new page
    doc.addPage();

    // Set page background
    doc.setFillColor(hexToRgb(pageBackground).r, hexToRgb(pageBackground).g, hexToRgb(pageBackground).b);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    // Add image if available
    if (images[i + 1]) {
      try {
        const pageImageData = images[i + 1];
        const img = await loadImage(pageImageData);

        // Calculate dimensions
        const imgRatio = img.height / img.width;
        let imgWidth = contentWidth;
        let imgHeight = imgWidth * imgRatio;

        // If image is too tall, scale it down
        if (imgHeight > pageHeight * 0.6) {
          imgHeight = pageHeight * 0.6;
          imgWidth = imgHeight / imgRatio;
        }

        // Center the image horizontally
        const imgX = (pageWidth - imgWidth) / 2;
        const imgY = margin;

        doc.addImage(img, 'JPEG', imgX, imgY, imgWidth, imgHeight);
      } catch (error) {
        console.error(`Error adding image for page ${i + 1}:`, error);
      }
    }

    // Add text
    if (storyData.pages[i].text) {
      doc.setFontSize(textFontSize);
      doc.setTextColor(0, 0, 0);

      const textY = pageHeight * 0.75;
      const textLines = doc.splitTextToSize(storyData.pages[i].text, contentWidth);

      textLines.forEach((line, lineIndex) => {
        doc.text(line, pageWidth / 2, textY + (lineIndex * (textFontSize / 2 + 2)), { align: 'center' });
      });
    }

    // Add page number
    doc.setFontSize(10);
    doc.setTextColor(150, 150, 150);
    doc.text(`${i + 1}`, pageWidth - margin, pageHeight - margin);
  }

  // Save the PDF
  return doc.output('blob');
};

// Helper functions
function hexToRgb(hex: string) {
  // Remove the hash if it exists
  hex = hex.replace(/^#/, '');

  // Parse the hex values
  const bigint = parseInt(hex, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;

  return { r, g, b };
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;

    // Handle both base64 and URLs
    if (src.startsWith('data:') || src.startsWith('http')) {
      img.src = src;
    } else {
      img.src = `data:image/jpeg;base64,${src}`;
    }
  });
}

export default {
  generateStorybook
};