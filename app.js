/**
 * Main Application Module
 * Handles UI interactions and coordinates parsing and visualization
 */

import { TSQLParser } from './tsql-parser.js';
import { FlowchartGenerator } from './flowchart-generator.js';

// Initialize Mermaid
mermaid.initialize({
    startOnLoad: false,
    theme: 'default',
    flowchart: {
        useMaxWidth: true,
        htmlLabels: true,
        curve: 'basis'
    }
});

// Example T-SQL procedure
const EXAMPLE_PROCEDURE = `CREATE PROCEDURE ProcessOrder
    @OrderID INT,
    @CustomerID INT
AS
BEGIN
    -- Declare variables
    DECLARE @OrderStatus VARCHAR(50);
    DECLARE @TotalAmount DECIMAL(10,2);

    -- Check if order exists
    SELECT @OrderStatus = Status, @TotalAmount = TotalAmount
    FROM Orders
    WHERE OrderID = @OrderID;

    -- Process based on order status
    IF @OrderStatus = 'Pending'
    BEGIN
        -- Update order status
        UPDATE Orders
        SET Status = 'Processing',
            ProcessedDate = GETDATE()
        WHERE OrderID = @OrderID;

        -- Check inventory
        EXEC CheckInventoryAvailability @OrderID;

        -- Verify customer credit
        IF EXISTS (SELECT 1 FROM Customers WHERE CustomerID = @CustomerID AND CreditLimit >= @TotalAmount)
        BEGIN
            -- Approve order
            UPDATE Orders
            SET Status = 'Approved'
            WHERE OrderID = @OrderID;

            -- Insert into shipping queue
            INSERT INTO ShippingQueue (OrderID, QueueDate, Priority)
            VALUES (@OrderID, GETDATE(), 'Normal');

            -- Send notification
            EXEC SendOrderNotification @CustomerID, @OrderID, 'Approved';
        END
        ELSE
        BEGIN
            -- Reject order
            UPDATE Orders
            SET Status = 'Rejected',
                RejectionReason = 'Insufficient Credit'
            WHERE OrderID = @OrderID;

            -- Log rejection
            INSERT INTO OrderLog (OrderID, Action, ActionDate, Reason)
            VALUES (@OrderID, 'Rejected', GETDATE(), 'Credit limit exceeded');

            -- Notify customer
            EXEC SendOrderNotification @CustomerID, @OrderID, 'Rejected';
        END
    END
    ELSE IF @OrderStatus = 'Processing'
    BEGIN
        -- Already processing
        PRINT 'Order is already being processed';
    END
    ELSE
    BEGIN
        -- Invalid status
        PRINT 'Order status is invalid for processing';
    END

    -- Return success
    RETURN 0;
END`;

class SQLProcFlowApp {
    constructor() {
        this.parser = new TSQLParser();
        this.generator = new FlowchartGenerator();
        this.parseResult = null;

        this.initializeElements();
        this.attachEventListeners();
    }

    initializeElements() {
        this.sqlInput = document.getElementById('sqlInput');
        this.generateBtn = document.getElementById('generateBtn');
        this.loadExampleBtn = document.getElementById('loadExample');
        this.clearBtn = document.getElementById('clearBtn');
        this.downloadBtn = document.getElementById('downloadBtn');
        this.flowchartContainer = document.getElementById('flowchartContainer');
        this.statsContainer = document.getElementById('statsContainer');
    }

    attachEventListeners() {
        this.generateBtn.addEventListener('click', () => this.generateFlowchart());
        this.loadExampleBtn.addEventListener('click', () => this.loadExample());
        this.clearBtn.addEventListener('click', () => this.clear());
        this.downloadBtn.addEventListener('click', () => this.downloadSVG());

        // Allow Ctrl/Cmd + Enter to generate
        this.sqlInput.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                this.generateFlowchart();
            }
        });
    }

    loadExample() {
        this.sqlInput.value = EXAMPLE_PROCEDURE;
        this.sqlInput.focus();
    }

    clear() {
        this.sqlInput.value = '';
        this.flowchartContainer.innerHTML = `
            <div class="placeholder">
                <svg width="100" height="100" viewBox="0 0 100 100">
                    <rect x="10" y="10" width="80" height="30" fill="#e0e0e0" rx="5"/>
                    <rect x="10" y="50" width="80" height="30" fill="#e0e0e0" rx="5"/>
                    <line x1="50" y1="40" x2="50" y2="50" stroke="#999" stroke-width="2"/>
                </svg>
                <p>Your flowchart will appear here</p>
            </div>
        `;
        this.flowchartContainer.classList.remove('has-content');
        this.statsContainer.classList.remove('visible');
        this.downloadBtn.disabled = true;
        this.sqlInput.focus();
    }

    async generateFlowchart() {
        const sql = this.sqlInput.value.trim();

        if (!sql) {
            this.showError('Please enter T-SQL code to visualize');
            return;
        }

        try {
            // Show loading state
            this.generateBtn.disabled = true;
            this.generateBtn.innerHTML = '<span class="loading"></span> Generating...';

            // Parse the SQL
            this.parseResult = this.parser.parse(sql);

            // Generate Mermaid code
            const mermaidCode = this.generator.generate(this.parseResult);

            // Render the flowchart
            await this.renderFlowchart(mermaidCode);

            // Show statistics
            this.showStatistics();

            // Enable download
            this.downloadBtn.disabled = false;

        } catch (error) {
            console.error('Error generating flowchart:', error);
            this.showError('Error generating flowchart: ' + error.message);
        } finally {
            this.generateBtn.disabled = false;
            this.generateBtn.textContent = 'Generate Flowchart';
        }
    }

    async renderFlowchart(mermaidCode) {
        // Clear container
        this.flowchartContainer.innerHTML = '';
        this.flowchartContainer.classList.add('has-content');

        // Create a div for mermaid
        const mermaidDiv = document.createElement('div');
        mermaidDiv.className = 'mermaid';
        mermaidDiv.textContent = mermaidCode;

        this.flowchartContainer.appendChild(mermaidDiv);

        // Render with mermaid
        try {
            await mermaid.run({
                nodes: [mermaidDiv]
            });
        } catch (error) {
            throw new Error('Failed to render flowchart: ' + error.message);
        }
    }

    showStatistics() {
        const { statements, tables, procedures, variables } = this.parseResult;

        const statsHTML = `
            <h3>Analysis Results</h3>
            <div class="stats-grid">
                <div class="stat-item">
                    <span class="stat-label">Statements:</span>
                    <span class="stat-value">${statements.length}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Tables:</span>
                    <span class="stat-value">${tables.length}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Procedures:</span>
                    <span class="stat-value">${procedures.length}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Variables:</span>
                    <span class="stat-value">${variables.length}</span>
                </div>
            </div>
            ${tables.length > 0 ? `
                <p style="margin-top: 12px;">
                    <strong>Tables:</strong> ${tables.join(', ')}
                </p>
            ` : ''}
            ${procedures.length > 0 ? `
                <p style="margin-top: 8px;">
                    <strong>Procedures:</strong> ${procedures.join(', ')}
                </p>
            ` : ''}
        `;

        this.statsContainer.innerHTML = statsHTML;
        this.statsContainer.classList.add('visible');
    }

    showError(message) {
        const errorHTML = `
            <div class="error-message">
                <strong>Error</strong>
                <p>${message}</p>
            </div>
        `;

        this.flowchartContainer.innerHTML = errorHTML;
        this.flowchartContainer.classList.remove('has-content');
    }

    downloadSVG() {
        const svg = this.flowchartContainer.querySelector('svg');
        if (!svg) {
            alert('No flowchart to download');
            return;
        }

        // Clone the SVG to avoid modifying the original
        const svgClone = svg.cloneNode(true);

        // Serialize the SVG
        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(svgClone);

        // Create a blob
        const blob = new Blob([svgString], { type: 'image/svg+xml' });

        // Create download link
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'procedure-flowchart.svg';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new SQLProcFlowApp();
});
