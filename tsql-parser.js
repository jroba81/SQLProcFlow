/**
 * T-SQL Parser Module
 * Parses T-SQL stored procedures and extracts statements, tables, and procedures
 */

export class TSQLParser {
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
