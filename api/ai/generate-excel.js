import * as XLSX from 'xlsx';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const {
            userName,
            businessIdea,
            category,
            coordinates,
            zoneType,
            confidence,
            confidenceLabel,
            opportunityText,
            clusterMetrics,
            bestCluster,
            topBusinesses,
            finalSuggestion
        } = req.body;

        if (!userName) {
            return res.status(400).json({ error: 'Missing required data' });
        }

        // Create workbook
        const workbook = XLSX.utils.book_new();

        // Format date
        const reportDate = new Date().toLocaleDateString('en-PH', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        // Extract values
        const lat = coordinates?.latitude?.toFixed(6) || 'N/A';
        const lng = coordinates?.longitude?.toFixed(6) || 'N/A';
        const zone = zoneType || bestCluster?.zoneType || bestCluster?.friendlyName || 'Mixed Zone';
        const conf = confidence || bestCluster?.confidence || 80;
        const confLabel = confidenceLabel || bestCluster?.confidenceLabel || 'Good Choice';
        const opportunity = opportunityText || 'Moderate';
        const totalCount = clusterMetrics?.totalCount || 0;
        const within500 = clusterMetrics?.within500 || 0;
        const within1k = clusterMetrics?.within1k || 0;
        const within2k = clusterMetrics?.within2k || 0;

        // ===== Sheet 1: Report =====
        const reportData = [
            ['CLUSTERING REPORT'],
            ['Strategic Store Placement System'],
            [''],
            ['Prepared for:', userName],
            ['Date:', reportDate],
            ['Business Idea:', businessIdea || 'Not specified'],
            [''],
            ['LOCATION SUMMARY'],
            ['Field', 'Value'],
            ['Latitude', lat],
            ['Longitude', lng],
            ['Zone Type', zone],
            ['Confidence', `${conf}% - ${confLabel}`],
            ['Opportunity', opportunity],
            [''],
            ['CLUSTER METRICS'],
            ['Field', 'Value'],
            ['Total Count', totalCount],
            ['Within 500m', within500],
            ['Within 1km', within1k],
            ['Within 2km', within2k],
        ];

        const reportSheet = XLSX.utils.aoa_to_sheet(reportData);

        // Set column widths
        reportSheet['!cols'] = [
            { wch: 20 },  // Column A
            { wch: 40 }   // Column B
        ];

        // Add bold styling indicators (XLSX doesn't support full styling without xlsx-style)
        XLSX.utils.book_append_sheet(workbook, reportSheet, 'Report');

        // ===== Sheet 2: Business Recommendation =====
        const businessContent = [];
        businessContent.push([`AI-Generated Business Recommendation for ${userName}`]);
        businessContent.push(['']);
        businessContent.push(['Date: ' + reportDate]);
        businessContent.push(['Business Idea: ' + (businessIdea || 'Not specified')]);
        businessContent.push(['']);

        // Best Cluster Summary
        if (bestCluster) {
            businessContent.push(['RECOMMENDED LOCATION']);
            businessContent.push([`Zone: ${bestCluster.zoneType || bestCluster.friendlyName || zone}`]);
            businessContent.push([`Reason: ${bestCluster.reason || 'This location shows strong potential.'}`]);
            businessContent.push(['']);
        }

        // Top 3 Business Recommendations
        if (topBusinesses && topBusinesses.length > 0) {
            businessContent.push(['TOP BUSINESS RECOMMENDATIONS']);
            businessContent.push(['']);

            topBusinesses.forEach((biz, index) => {
                businessContent.push([`${index + 1}. ${biz.name}`]);
                businessContent.push([`   Score: ${biz.score}/100 | Fit: ${biz.fitPercentage}% | ${biz.opportunityLevel}`]);
                businessContent.push([`   ${biz.shortDescription || ''}`]);
                businessContent.push([`   Startup Budget: ${biz.startupBudget || 'N/A'}`]);
                businessContent.push([`   Preferred Location: ${biz.preferredLocation || 'N/A'}`]);
                businessContent.push([`   Competitor Presence: ${biz.competitorPresence || 'N/A'}`]);
                businessContent.push([`   Business Density: ${biz.businessDensityInsight || 'N/A'}`]);
                businessContent.push(['']);

                // Full Details paragraph
                if (biz.fullDetails) {
                    businessContent.push(['   Full Analysis:']);
                    businessContent.push([`   ${biz.fullDetails}`]);
                    businessContent.push(['']);
                }
            });
        }

        // Final Suggestion
        if (finalSuggestion) {
            businessContent.push(['FINAL SUGGESTION']);
            businessContent.push([finalSuggestion]);
            businessContent.push(['']);
        }

        // Market Analysis Paragraphs
        businessContent.push(['MARKET ANALYSIS']);
        businessContent.push(['']);

        businessContent.push(['Fit with Local Market:']);
        businessContent.push([`Your business idea "${businessIdea || 'proposed business'}" aligns well with the ${zone}. The area shows ${opportunity.toLowerCase()} opportunity based on current business density and competition levels.`]);
        businessContent.push(['']);

        businessContent.push(['Competitive Advantages:']);
        businessContent.push([`Based on clustering results, this location offers ${conf >= 75 ? 'strong' : conf >= 50 ? 'moderate' : 'developing'} potential. The ${zone} provides a ${conf >= 70 ? 'favorable' : 'challenging but manageable'} environment for new businesses.`]);
        businessContent.push(['']);

        businessContent.push(['Expected Profitability:']);
        businessContent.push([`With ${within500} businesses within 500m and ${within1k} within 1km, the area shows ${within500 >= 10 ? 'high' : within500 >= 5 ? 'moderate' : 'developing'} commercial activity. This suggests ${within500 >= 5 ? 'steady' : 'growing'} foot traffic and customer base.`]);
        businessContent.push(['']);

        businessContent.push(['Foot Traffic Behavior:']);
        businessContent.push([`The ${zone} typically experiences ${totalCount >= 20 ? 'heavy' : totalCount >= 10 ? 'moderate' : 'light'} foot traffic. Peak hours are likely during business hours with increased activity during weekends.`]);
        businessContent.push(['']);

        businessContent.push(['Suggested Improvements:']);
        businessContent.push(['1. Focus on service quality to stand out from competitors']);
        businessContent.push(['2. Consider extended operating hours to capture more customers']);
        businessContent.push(['3. Build relationships with nearby businesses for cross-promotion']);
        businessContent.push(['4. Invest in visible signage and marketing materials']);
        businessContent.push(['']);

        businessContent.push(['---']);
        businessContent.push(['Generated by Strategic Store Placement System']);

        const businessSheet = XLSX.utils.aoa_to_sheet(businessContent);

        // Set column width for readable paragraphs
        businessSheet['!cols'] = [
            { wch: 100 }  // Column A - wide for paragraphs
        ];

        XLSX.utils.book_append_sheet(workbook, businessSheet, 'Business Recommendation');

        // Generate Excel buffer
        const excelBuffer = XLSX.write(workbook, {
            type: 'buffer',
            bookType: 'xlsx',
            compression: true
        });

        // Send Excel response
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="Clustering_Report_${userName.replace(/\s+/g, '_')}.xlsx"`);
        res.setHeader('Content-Length', excelBuffer.length);

        return res.status(200).send(excelBuffer);

    } catch (err) {
        console.error('Excel Generation Error:', err.message);
        return res.status(500).json({ error: 'Excel generation failed', message: err.message });
    }
}
