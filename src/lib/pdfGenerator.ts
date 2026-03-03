import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

/**
 * Generates an A4 PDF from an HTML element
 * @param elementId The ID of the HTML element to render
 * @param filename The desired filename for the downloaded PDF
 */
export const generateA4PDF = async (elementId: string, filename: string): Promise<boolean> => {
    try {
        const element = document.getElementById(elementId);
        if (!element) {
            console.error(`Element with id ${elementId} not found`);
            return false;
        }

        // Capture the element using a high scale for better quality
        const canvas = await html2canvas(element, {
            scale: 2, // 2x scale for better resolution
            useCORS: true, // Allow cross-origin images to be loaded
            windowWidth: element.scrollWidth,
            windowHeight: element.scrollHeight,
            onclone: (clonedElement) => {
                // You could optionally modify the cloned document before rendering here
                // e.g., hide buttons that shouldn't appear in the PDF.
                // Since we use print:hidden Tailwind classes on UI elements, html2canvas
                // doesn't respect CSS media queries by default unless configured or manipulated.
                // Wait, actually html2canvas DOES support basic block-level hiding 
                // but complex print queries are best handled by removing elements explicitly if needed.

                // Let's manually hide elements with the class 'print:hidden' in the clone
                const printHiddenElements = clonedElement.querySelectorAll('.print\\:hidden');
                printHiddenElements.forEach((el) => {
                    (el as HTMLElement).style.display = 'none';
                });
            }
        });

        // A4 dimensions in mm
        const pdf = new jsPDF('p', 'mm', 'a4');
        const a4WidthMm = 210;
        const a4HeightMm = 297;

        const imgData = canvas.toDataURL('image/jpeg', 1.0);

        // Calculate aspect ratio 
        const imgWidthPx = canvas.width;
        const imgHeightPx = canvas.height;

        // Map canvas width to A4 width
        const pdfImgWidth = a4WidthMm;
        const pdfImgHeight = (imgHeightPx * a4WidthMm) / imgWidthPx;

        let heightLeft = pdfImgHeight;
        let position = 0;

        // First page
        pdf.addImage(imgData, 'JPEG', 0, position, pdfImgWidth, pdfImgHeight);
        heightLeft -= a4HeightMm;

        // Add new pages if height left is positive
        while (heightLeft > 0) {
            position = heightLeft - pdfImgHeight; // Shift image up by the A4 height
            pdf.addPage();
            pdf.addImage(imgData, 'JPEG', 0, position, pdfImgWidth, pdfImgHeight);
            heightLeft -= a4HeightMm;
        }

        pdf.save(filename);
        return true;

    } catch (error) {
        console.error('Error generating PDF:', error);
        return false;
    }
};
