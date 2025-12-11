import PDFDocument from 'pdfkit';
import { Readable } from 'stream';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const {
            userName,
            businessIdea,
            category,
            mapImageBase64,
            coordinates,
            zoneType,
            confidence,
            confidenceLabel,
            opportunityText,
            clusterMetrics,
            bestCluster,
            topBusinesses,
            clusterSummary,
            finalSuggestion
        } = req.body;

        if (!userName) {
            return res.status(400).json({ error: 'Missing required data' });
        }

        // Create PDF document
        const doc = new PDFDocument({
            size: 'A4',
            margins: { top: 50, bottom: 50, left: 50, right: 50 },
            info: {
                Title: 'Clustering Report - Strategic Store Placement System',
                Author: 'Strategic Store Placement System',
                Subject: 'Business Location Analysis',
                Creator: 'SSP AI System'
            }
        });

        // Collect PDF data
        const chunks = [];
        doc.on('data', chunk => chunks.push(chunk));

        // Format date
        const reportDate = new Date().toLocaleDateString('en-PH', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        // Colors
        const primaryColor = '#1e3a5f';
        const accentColor = '#2563eb';
        const textColor = '#333333';
        const lightGray = '#f5f5f5';

        // Title Section
        doc.fontSize(28)
            .fillColor(primaryColor)
            .text('Clustering Report', { align: 'center' });

        doc.fontSize(14)
            .fillColor(accentColor)
            .text('Strategic Store Placement System', { align: 'center' });

        doc.moveDown(0.5);
        doc.fontSize(11)
            .fillColor(textColor)
            .text(`Prepared for: ${userName}`, { align: 'center' });
        doc.text(`Date: ${reportDate}`, { align: 'center' });
        doc.text(`Business Idea: ${businessIdea || 'Not specified'}`, { align: 'center' });

        doc.moveDown(1.5);

        // Map Section
        if (mapImageBase64) {
            doc.fontSize(14)
                .fillColor(primaryColor)
                .text('AI-Optimized Recommended Location', { underline: true });
            doc.moveDown(0.5);

            try {
                // Remove data URL prefix if present
                const base64Data = mapImageBase64.replace(/^data:image\/\w+;base64,/, '');
                const imageBuffer = Buffer.from(base64Data, 'base64');

                doc.image(imageBuffer, {
                    fit: [500, 300],
                    align: 'center'
                });
                doc.moveDown(1);
            } catch (imgErr) {
                doc.fontSize(10)
                    .fillColor('#999')
                    .text('[Map image could not be embedded]', { align: 'center' });
                doc.moveDown(1);
            }
        }

        // Location Summary Section
        doc.fontSize(14)
            .fillColor(primaryColor)
            .text('Location Summary', { underline: true });
        doc.moveDown(0.5);

        const lat = coordinates?.latitude?.toFixed(6) || 'N/A';
        const lng = coordinates?.longitude?.toFixed(6) || 'N/A';
        const zone = zoneType || bestCluster?.zoneType || bestCluster?.friendlyName || 'Mixed Zone';
        const conf = confidence || bestCluster?.confidence || 80;
        const confLabel = confidenceLabel || bestCluster?.confidenceLabel || 'Good Choice';
        const opportunity = opportunityText || 'Moderate';

        // Draw table
        const tableTop = doc.y;
        const tableData = [
            ['Latitude', lat],
            ['Longitude', lng],
            ['Zone Type', zone],
            ['Confidence', `${conf}% - ${confLabel}`],
            ['Opportunity', opportunity]
        ];

        doc.fontSize(10).fillColor(textColor);
        tableData.forEach(([label, value], i) => {
            const y = tableTop + (i * 20);
            doc.rect(50, y, 200, 20).fill(i % 2 === 0 ? lightGray : '#ffffff');
            doc.fillColor(textColor)
                .text(label, 55, y + 5, { width: 90 })
                .text(value, 150, y + 5, { width: 100 });
        });
        doc.y = tableTop + (tableData.length * 20) + 20;

        // Cluster Metrics Section
        if (clusterMetrics) {
            doc.fontSize(14)
                .fillColor(primaryColor)
                .text('Cluster Metrics', { underline: true });
            doc.moveDown(0.5);

            const metricsTop = doc.y;
            const metricsData = [
                ['Total Count', clusterMetrics.totalCount || 0],
                ['Within 500m', clusterMetrics.within500 || 0],
                ['Within 1km', clusterMetrics.within1k || 0],
                ['Within 2km', clusterMetrics.within2k || 0]
            ];

            doc.fontSize(10).fillColor(textColor);
            metricsData.forEach(([label, value], i) => {
                const y = metricsTop + (i * 20);
                doc.rect(50, y, 200, 20).fill(i % 2 === 0 ? lightGray : '#ffffff');
                doc.fillColor(textColor)
                    .text(label, 55, y + 5, { width: 90 })
                    .text(String(value), 150, y + 5, { width: 100 });
            });
            doc.y = metricsTop + (metricsData.length * 20) + 20;
        }

        // AI Business Recommendations Section
        doc.addPage();
        doc.fontSize(18)
            .fillColor(primaryColor)
            .text('AI Business Recommendations', { align: 'center' });
        doc.moveDown(1);

        // Best Cluster Info
        if (bestCluster) {
            doc.fontSize(12)
                .fillColor(accentColor)
                .text(`Best Location: ${bestCluster.zoneType || bestCluster.friendlyName || 'Recommended Zone'}`);
            doc.fontSize(10)
                .fillColor(textColor)
                .text(bestCluster.reason || 'This location shows strong potential for your business.');
            doc.moveDown(1);
        }

        // Top 3 Businesses
        if (topBusinesses && topBusinesses.length > 0) {
            doc.fontSize(14)
                .fillColor(primaryColor)
                .text('Top 3 Recommended Businesses', { underline: true });
            doc.moveDown(0.5);

            topBusinesses.forEach((biz, index) => {
                doc.fontSize(12)
                    .fillColor(accentColor)
                    .text(`${index + 1}. ${biz.name}`);

                doc.fontSize(10)
                    .fillColor(textColor)
                    .text(`Score: ${biz.score}/100 | Fit: ${biz.fitPercentage}% | ${biz.opportunityLevel}`);

                doc.fontSize(10)
                    .fillColor('#666')
                    .text(biz.shortDescription || '');

                if (biz.startupBudget) {
                    doc.text(`Startup Budget: ${biz.startupBudget}`);
                }
                if (biz.preferredLocation) {
                    doc.text(`Preferred Location: ${biz.preferredLocation}`);
                }

                doc.moveDown(0.8);
            });
        }

        // Final Suggestion
        if (finalSuggestion) {
            doc.moveDown(0.5);
            doc.fontSize(12)
                .fillColor(primaryColor)
                .text('Final Suggestion', { underline: true });
            doc.moveDown(0.3);
            doc.fontSize(10)
                .fillColor(textColor)
                .text(finalSuggestion, { align: 'justify' });
        }

        // Footer on each page
        const pages = doc.bufferedPageRange();
        for (let i = 0; i < pages.count; i++) {
            doc.switchToPage(i);
            doc.fontSize(8)
                .fillColor('#999')
                .text(
                    'Generated automatically by the Strategic Store Placement System',
                    50,
                    doc.page.height - 40,
                    { align: 'center', width: doc.page.width - 100 }
                );
            doc.text(
                `Page ${i + 1} of ${pages.count}`,
                50,
                doc.page.height - 30,
                { align: 'center', width: doc.page.width - 100 }
            );
        }

        // Finalize PDF
        doc.end();

        // Wait for PDF generation to complete
        await new Promise((resolve) => {
            doc.on('end', resolve);
        });

        // Combine chunks into a single buffer
        const pdfBuffer = Buffer.concat(chunks);

        // Send PDF response
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Clustering_Report_${userName.replace(/\s+/g, '_')}.pdf"`);
        res.setHeader('Content-Length', pdfBuffer.length);

        return res.status(200).send(pdfBuffer);

    } catch (err) {
        console.error('PDF Generation Error:', err.message);
        return res.status(500).json({ error: 'PDF generation failed', message: err.message });
    }
}
