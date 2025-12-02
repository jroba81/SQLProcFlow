# SQLProcFlow - T-SQL Stored Procedure Visualizer

A JavaScript-based web application that parses T-SQL stored procedures and generates visual flowcharts showing the procedure's execution flow, including all tables and stored procedures being utilized.

## Features

- **T-SQL Parsing**: Analyzes stored procedure code to extract statements and operations
- **Visual Flowchart**: Generates an interactive flowchart representation of the procedure
- **Table & Procedure Detection**: Identifies and highlights all tables and stored procedures referenced
- **Control Flow Visualization**: Shows IF statements, loops, and conditional branches
- **Pure JavaScript**: No backend required - runs entirely in the browser

## Supported T-SQL Elements

- SELECT, INSERT, UPDATE, DELETE statements
- EXEC/EXECUTE stored procedure calls
- IF/ELSE conditional statements
- WHILE loops
- BEGIN/END blocks
- Variable declarations and assignments
- Table and procedure name extraction

## Usage

1. Open `index.html` in a web browser
2. Paste your T-SQL stored procedure code into the text area
3. Click "Generate Flowchart"
4. View the visual representation of your procedure

## Technology Stack

- HTML5
- CSS3
- Vanilla JavaScript (ES6+)
- [Mermaid.js](https://mermaid.js.org/) for flowchart rendering

## Getting Started

Simply open `index.html` in any modern web browser. No build process or dependencies required!

## Example

```sql
CREATE PROCEDURE ProcessOrder
    @OrderID INT
AS
BEGIN
    -- Check if order exists
    IF EXISTS (SELECT 1 FROM Orders WHERE OrderID = @OrderID)
    BEGIN
        -- Update order status
        UPDATE Orders
        SET Status = 'Processing'
        WHERE OrderID = @OrderID;

        -- Log the action
        INSERT INTO OrderLog (OrderID, Action, ActionDate)
        VALUES (@OrderID, 'Processing', GETDATE());

        -- Call inventory check
        EXEC CheckInventory @OrderID;
    END
END
```

The app will generate a flowchart showing each step with the tables and procedures involved.

## License

MIT License
