/**
 * SQLProcFlow - T-SQL Stored Procedure Visualizer
 * Combined JavaScript (no modules for browser compatibility)
 */

// ============================================================================
// T-SQL Parser Class
// ============================================================================

class TSQLParser {
    constructor() {
        this.statements = [];
        this.tables = new Set();
        this.procedures = new Set();
        this.variables = new Set();
    }

    /**
     * Remove comments from SQL code
     */
    removeComments(sql) {
        // Remove single-line comments
        sql = sql.replace(/--[^\n]*/g, '');
        // Remove multi-line comments
        sql = sql.replace(/\/\*[\s\S]*?\*\//g, '');
        return sql;
    }

    /**
     * Extract table names from a SQL statement
     */
    extractTables(statement) {
        const tables = [];
        const patterns = [
            /FROM\s+(\[?[\w]+\]?\.?\[?[\w]+\]?)/gi,
            /JOIN\s+(\[?[\w]+\]?\.?\[?[\w]+\]?)/gi,
            /INTO\s+(\[?[\w]+\]?\.?\[?[\w]+\]?)/gi,
            /UPDATE\s+(\[?[\w]+\]?\.?\[?[\w]+\]?)/gi,
            /DELETE\s+FROM\s+(\[?[\w]+\]?\.?\[?[\w]+\]?)/gi,
        ];

        patterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(statement)) !== null) {
                const tableName = match[1].replace(/[\[\]]/g, '').trim();
                if (tableName && !this.isVariable(tableName)) {
                    tables.push(tableName);
                    this.tables.add(tableName);
                }
            }
        });

        return tables;
    }

    /**
     * Extract procedure names from EXEC statements
     */
    extractProcedures(statement) {
        const procedures = [];
        const patterns = [
            /EXEC(?:UTE)?\s+(\[?[\w]+\]?\.?\[?[\w]+\]?)/gi,
        ];

        patterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(statement)) !== null) {
                const procName = match[1].replace(/[\[\]]/g, '').trim();
                if (procName && !this.isVariable(procName)) {
                    procedures.push(procName);
                    this.procedures.add(procName);
                }
            }
        });

        return procedures;
    }

    /**
     * Check if a name is a variable
     */
    isVariable(name) {
        return name.startsWith('@');
    }

    /**
     * Determine the type of SQL statement
     */
    getStatementType(statement) {
        const trimmed = statement.trim().toUpperCase();

        if (trimmed.startsWith('SELECT')) return 'SELECT';
        if (trimmed.startsWith('INSERT')) return 'INSERT';
        if (trimmed.startsWith('UPDATE')) return 'UPDATE';
        if (trimmed.startsWith('DELETE')) return 'DELETE';
        if (trimmed.startsWith('EXEC')) return 'EXEC';
        if (trimmed.startsWith('IF')) return 'IF';
        if (trimmed.startsWith('ELSE')) return 'ELSE';
        if (trimmed.startsWith('WHILE')) return 'WHILE';
        if (trimmed.startsWith('DECLARE')) return 'DECLARE';
        if (trimmed.startsWith('SET')) return 'SET';
        if (trimmed.startsWith('BEGIN')) return 'BEGIN';
        if (trimmed.startsWith('END')) return 'END';
        if (trimmed.startsWith('RETURN')) return 'RETURN';
        if (trimmed.startsWith('PRINT')) return 'PRINT';
        if (trimmed.startsWith('CREATE PROCEDURE') || trimmed.startsWith('CREATE PROC')) return 'PROC_DEF';
        if (trimmed.includes('TRANSACTION')) return 'TRANSACTION';

        return 'OTHER';
    }

    /**
     * Parse the stored procedure into structured statements
     */
    parse(sql) {
        // Reset state
        this.statements = [];
        this.tables = new Set();
        this.procedures = new Set();
        this.variables = new Set();

        // Remove comments
        sql = this.removeComments(sql);

        // Split by statement terminators and common keywords
        const lines = sql.split('\n');
        let currentStatement = '';
        let blockLevel = 0;
        let statementId = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            if (!line) continue;

            currentStatement += ' ' + line;

            // Track BEGIN/END blocks
            if (line.toUpperCase().includes('BEGIN')) {
                if (currentStatement.trim().length > 5) {
                    this.processStatement(currentStatement, statementId++, blockLevel);
                    currentStatement = '';
                }
                blockLevel++;
                continue;
            }

            if (line.toUpperCase().includes('END')) {
                blockLevel = Math.max(0, blockLevel - 1);
                if (currentStatement.trim().length > 5) {
                    this.processStatement(currentStatement, statementId++, blockLevel + 1);
                    currentStatement = '';
                }
                continue;
            }

            // Statement terminators
            if (line.endsWith(';') ||
                this.isControlFlowKeyword(line) ||
                this.isStandaloneStatement(currentStatement)) {

                if (currentStatement.trim()) {
                    this.processStatement(currentStatement, statementId++, blockLevel);
                }
                currentStatement = '';
            }
        }

        // Process any remaining statement
        if (currentStatement.trim()) {
            this.processStatement(currentStatement, statementId++, blockLevel);
        }

        return {
            statements: this.statements,
            tables: Array.from(this.tables),
            procedures: Array.from(this.procedures),
            variables: Array.from(this.variables)
        };
    }

    /**
     * Check if a line contains a control flow keyword
     */
    isControlFlowKeyword(line) {
        const upper = line.toUpperCase().trim();
        return upper.startsWith('IF ') ||
               upper === 'ELSE' ||
               upper.startsWith('WHILE ') ||
               upper.startsWith('RETURN');
    }

    /**
     * Check if current statement is complete
     */
    isStandaloneStatement(statement) {
        const trimmed = statement.trim().toUpperCase();
        return trimmed.startsWith('DECLARE') ||
               trimmed.startsWith('SET ') ||
               trimmed.startsWith('PRINT ');
    }

    /**
     * Process a single statement
     */
    processStatement(statement, id, blockLevel) {
        statement = statement.trim();
        if (!statement) return;

        const type = this.getStatementType(statement);

        // Skip procedure definition line
        if (type === 'PROC_DEF') return;

        const tables = this.extractTables(statement);
        const procedures = this.extractProcedures(statement);

        // Extract variables from DECLARE statements
        if (type === 'DECLARE') {
            const varMatch = statement.match(/@[\w]+/g);
            if (varMatch) {
                varMatch.forEach(v => this.variables.add(v));
            }
        }

        // Create a description for the statement
        const description = this.generateDescription(statement, type, tables, procedures);

        this.statements.push({
            id,
            type,
            statement: statement.substring(0, 200), // Limit length
            description,
            tables,
            procedures,
            blockLevel
        });
    }

    /**
     * Generate a human-readable description for a statement
     */
    generateDescription(statement, type, tables, procedures) {
        const short = statement.length > 60 ? statement.substring(0, 60) + '...' : statement;

        switch (type) {
            case 'SELECT':
                return tables.length > 0
                    ? `Query data from ${tables.join(', ')}`
                    : 'Query data';

            case 'INSERT':
                return tables.length > 0
                    ? `Insert data into ${tables.join(', ')}`
                    : 'Insert data';

            case 'UPDATE':
                return tables.length > 0
                    ? `Update ${tables.join(', ')}`
                    : 'Update data';

            case 'DELETE':
                return tables.length > 0
                    ? `Delete from ${tables.join(', ')}`
                    : 'Delete data';

            case 'EXEC':
                return procedures.length > 0
                    ? `Execute ${procedures.join(', ')}`
                    : 'Execute procedure';

            case 'IF':
                return 'Check condition';

            case 'ELSE':
                return 'Alternative path';

            case 'WHILE':
                return 'Loop while condition is true';

            case 'DECLARE':
                return 'Declare variables';

            case 'SET':
                return 'Set variable value';

            case 'RETURN':
                return 'Return from procedure';

            case 'PRINT':
                return 'Print message';

            case 'TRANSACTION':
                if (statement.toUpperCase().includes('BEGIN')) {
                    return 'Begin transaction';
                } else if (statement.toUpperCase().includes('COMMIT')) {
                    return 'Commit transaction';
                } else if (statement.toUpperCase().includes('ROLLBACK')) {
                    return 'Rollback transaction';
                }
                return 'Transaction operation';

            default:
                return short;
        }
    }
}

// ============================================================================
// Flowchart Generator Class
// ============================================================================

class FlowchartGenerator {
    constructor() {
        this.mermaidCode = '';
        this.nodeCounter = 0;
    }

    /**
     * Generate Mermaid flowchart from parsed statements
     */
    generate(parseResult) {
        this.mermaidCode = 'flowchart TD\n';
        this.nodeCounter = 0;

        const { statements } = parseResult;

        if (statements.length === 0) {
            return 'flowchart TD\n    Start([Start])\n    End([End])\n    Start --> End';
        }

        // Add start node
        this.mermaidCode += '    Start([Start Procedure])\n';

        let previousNode = 'Start';
        let ifStack = [];
        let loopStack = [];

        for (let i = 0; i < statements.length; i++) {
            const stmt = statements[i];
            const nodeId = `node${this.nodeCounter++}`;

            switch (stmt.type) {
                case 'DECLARE':
                case 'SET':
                    // Variable operations - simple rectangle
                    this.addNode(nodeId, stmt.description, 'rect');
                    this.addEdge(previousNode, nodeId);
                    previousNode = nodeId;
                    break;

                case 'IF':
                    // Conditional - diamond shape
                    const condition = this.extractCondition(stmt.statement);
                    this.addNode(nodeId, condition, 'diamond');
                    this.addEdge(previousNode, nodeId);

                    // Track IF for later ELSE handling
                    ifStack.push({
                        ifNode: nodeId,
                        afterIfNode: null,
                        hasElse: this.hasElse(statements, i)
                    });

                    previousNode = nodeId;
                    break;

                case 'ELSE':
                    // Handle ELSE branch
                    if (ifStack.length > 0) {
                        const ifInfo = ifStack[ifStack.length - 1];
                        const elseNode = `node${this.nodeCounter++}`;

                        this.addNode(elseNode, 'Alternative Path', 'rect');
                        this.addEdge(ifInfo.ifNode, elseNode, 'No');

                        previousNode = elseNode;
                    }
                    break;

                case 'WHILE':
                    // Loop - diamond shape
                    const loopCondition = this.extractCondition(stmt.statement);
                    this.addNode(nodeId, loopCondition, 'diamond');
                    this.addEdge(previousNode, nodeId);

                    loopStack.push({
                        loopNode: nodeId,
                        startNode: previousNode
                    });

                    previousNode = nodeId;
                    break;

                case 'SELECT':
                case 'INSERT':
                case 'UPDATE':
                case 'DELETE':
                    // Database operations
                    const dbNode = this.createDatabaseNode(stmt);
                    this.mermaidCode += dbNode;
                    this.addEdge(previousNode, nodeId);
                    previousNode = nodeId;
                    break;

                case 'EXEC':
                    // Procedure call - special shape
                    const procNode = this.createProcedureNode(stmt, nodeId);
                    this.mermaidCode += procNode;
                    this.addEdge(previousNode, nodeId);
                    previousNode = nodeId;
                    break;

                case 'RETURN':
                    // Return statement
                    this.addNode(nodeId, stmt.description, 'rect');
                    this.addEdge(previousNode, nodeId);

                    // Connect to end
                    this.addEdge(nodeId, 'End');
                    previousNode = null;
                    break;

                case 'PRINT':
                    // Print statement
                    this.addNode(nodeId, stmt.description, 'rect');
                    this.addEdge(previousNode, nodeId);
                    previousNode = nodeId;
                    break;

                case 'TRANSACTION':
                    // Transaction operation
                    this.addNode(nodeId, stmt.description, 'stadium');
                    this.addEdge(previousNode, nodeId);
                    previousNode = nodeId;
                    break;

                case 'BEGIN':
                    // Block start - usually handled implicitly
                    continue;

                case 'END':
                    // Block end - close IF or WHILE
                    if (ifStack.length > 0 && this.isIfEnd(statements, i)) {
                        const ifInfo = ifStack.pop();
                        const mergeNode = `node${this.nodeCounter++}`;

                        // Create merge point
                        this.addNode(mergeNode, ' ', 'circle');

                        if (previousNode) {
                            this.addEdge(previousNode, mergeNode);
                        }

                        // Connect IF path
                        if (!ifInfo.hasElse) {
                            this.addEdge(ifInfo.ifNode, mergeNode, 'No');
                        }

                        previousNode = mergeNode;
                    } else if (loopStack.length > 0) {
                        const loopInfo = loopStack.pop();

                        // Loop back to condition
                        if (previousNode) {
                            this.addEdge(previousNode, loopInfo.loopNode, 'Loop back');
                        }

                        // Exit loop
                        const exitNode = `node${this.nodeCounter++}`;
                        this.addNode(exitNode, ' ', 'circle');
                        this.addEdge(loopInfo.loopNode, exitNode, 'Exit loop');

                        previousNode = exitNode;
                    }
                    continue;

                default:
                    // Other statements
                    if (stmt.description) {
                        this.addNode(nodeId, stmt.description, 'rect');
                        this.addEdge(previousNode, nodeId);
                        previousNode = nodeId;
                    }
            }
        }

        // Add end node
        this.mermaidCode += '    End([End Procedure])\n';

        if (previousNode && previousNode !== 'End') {
            this.addEdge(previousNode, 'End');
        }

        // Add styling
        this.addStyling();

        return this.mermaidCode;
    }

    /**
     * Add a node to the flowchart
     */
    addNode(nodeId, label, shape = 'rect') {
        const escapedLabel = this.escapeLabel(label);

        switch (shape) {
            case 'diamond':
                this.mermaidCode += `    ${nodeId}{${escapedLabel}}\n`;
                break;
            case 'circle':
                this.mermaidCode += `    ${nodeId}((${escapedLabel}))\n`;
                break;
            case 'stadium':
                this.mermaidCode += `    ${nodeId}([${escapedLabel}])\n`;
                break;
            case 'rect':
            default:
                this.mermaidCode += `    ${nodeId}[${escapedLabel}]\n`;
        }
    }

    /**
     * Add an edge between nodes
     */
    addEdge(from, to, label = '') {
        if (!from || !to) return;

        if (label) {
            const escapedLabel = this.escapeLabel(label);
            this.mermaidCode += `    ${from} -->|${escapedLabel}| ${to}\n`;
        } else {
            this.mermaidCode += `    ${from} --> ${to}\n`;
        }
    }

    /**
     * Create a database operation node with table info
     */
    createDatabaseNode(stmt) {
        const nodeId = `node${this.nodeCounter++}`;
        let label = stmt.description;

        if (stmt.tables.length > 0) {
            label += `<br/>📊 ${stmt.tables.join(', ')}`;
        }

        return `    ${nodeId}[${this.escapeLabel(label)}]\n`;
    }

    /**
     * Create a procedure call node
     */
    createProcedureNode(stmt, nodeId) {
        let label = stmt.description;

        if (stmt.procedures.length > 0) {
            label += `<br/>⚙️ ${stmt.procedures.join(', ')}`;
        }

        return `    ${nodeId}[[${this.escapeLabel(label)}]]\n`;
    }

    /**
     * Extract condition from IF or WHILE statement
     */
    extractCondition(statement) {
        const match = statement.match(/(?:IF|WHILE)\s+(.+?)(?:BEGIN|$)/i);
        if (match && match[1]) {
            let condition = match[1].trim();
            // Limit condition length
            if (condition.length > 50) {
                condition = condition.substring(0, 50) + '...';
            }
            return condition;
        }
        return 'Condition';
    }

    /**
     * Check if there's an ELSE following an IF
     */
    hasElse(statements, ifIndex) {
        for (let i = ifIndex + 1; i < statements.length; i++) {
            if (statements[i].type === 'ELSE') {
                return true;
            }
            if (statements[i].type === 'END') {
                return false;
            }
        }
        return false;
    }

    /**
     * Check if this END closes an IF block
     */
    isIfEnd(statements, endIndex) {
        let blockDepth = 0;
        for (let i = endIndex - 1; i >= 0; i--) {
            const type = statements[i].type;
            if (type === 'END') blockDepth++;
            if (type === 'BEGIN') blockDepth--;
            if (blockDepth === 0 && type === 'IF') {
                return true;
            }
        }
        return false;
    }

    /**
     * Escape special characters in labels
     */
    escapeLabel(label) {
        return label
            .replace(/"/g, '#quot;')
            .replace(/\[/g, '#91;')
            .replace(/\]/g, '#93;')
            .replace(/\(/g, '#40;')
            .replace(/\)/g, '#41;');
    }

    /**
     * Add styling to the flowchart
     */
    addStyling() {
        this.mermaidCode += '\n';
        this.mermaidCode += '    classDef startEnd fill:#10b981,stroke:#059669,stroke-width:2px,color:#fff\n';
        this.mermaidCode += '    classDef condition fill:#f59e0b,stroke:#d97706,stroke-width:2px,color:#fff\n';
        this.mermaidCode += '    classDef database fill:#3b82f6,stroke:#2563eb,stroke-width:2px,color:#fff\n';
        this.mermaidCode += '    classDef procedure fill:#8b5cf6,stroke:#7c3aed,stroke-width:2px,color:#fff\n';
        this.mermaidCode += '    class Start,End startEnd\n';
    }
}

// ============================================================================
// Main Application Class
// ============================================================================

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
