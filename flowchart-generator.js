/**
 * Flowchart Generator Module
 * Converts parsed T-SQL statements into Mermaid.js flowchart syntax
 */

export class FlowchartGenerator {
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
