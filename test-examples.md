# Test Examples for SQLProcFlow

This file contains various T-SQL procedure examples for testing the visualizer.

## Example 1: Simple CRUD Operations

```sql
CREATE PROCEDURE UpdateUserProfile
    @UserID INT,
    @Name VARCHAR(100),
    @Email VARCHAR(100)
AS
BEGIN
    UPDATE Users
    SET Name = @Name, Email = @Email, ModifiedDate = GETDATE()
    WHERE UserID = @UserID;

    INSERT INTO AuditLog (UserID, Action, ActionDate)
    VALUES (@UserID, 'Profile Updated', GETDATE());
END
```

## Example 2: Conditional Logic

```sql
CREATE PROCEDURE ProcessPayment
    @OrderID INT,
    @Amount DECIMAL(10,2)
AS
BEGIN
    DECLARE @Balance DECIMAL(10,2);

    SELECT @Balance = AccountBalance
    FROM CustomerAccounts
    WHERE OrderID = @OrderID;

    IF @Balance >= @Amount
    BEGIN
        UPDATE CustomerAccounts
        SET AccountBalance = AccountBalance - @Amount
        WHERE OrderID = @OrderID;

        INSERT INTO Transactions (OrderID, Amount, TransactionDate)
        VALUES (@OrderID, @Amount, GETDATE());
    END
    ELSE
    BEGIN
        INSERT INTO FailedTransactions (OrderID, Amount, Reason)
        VALUES (@OrderID, @Amount, 'Insufficient Funds');
    END
END
```

## Example 3: Loops

```sql
CREATE PROCEDURE ProcessBatch
    @BatchID INT
AS
BEGIN
    DECLARE @OrderID INT;
    DECLARE @Counter INT = 0;

    WHILE EXISTS (SELECT 1 FROM OrderQueue WHERE BatchID = @BatchID AND Processed = 0)
    BEGIN
        SELECT TOP 1 @OrderID = OrderID
        FROM OrderQueue
        WHERE BatchID = @BatchID AND Processed = 0;

        EXEC ProcessOrder @OrderID;

        UPDATE OrderQueue
        SET Processed = 1
        WHERE OrderID = @OrderID;

        SET @Counter = @Counter + 1;
    END

    PRINT 'Processed ' + CAST(@Counter AS VARCHAR) + ' orders';
END
```

## Example 4: Nested Procedures

```sql
CREATE PROCEDURE CreateNewOrder
    @CustomerID INT,
    @ProductID INT,
    @Quantity INT
AS
BEGIN
    DECLARE @OrderID INT;

    INSERT INTO Orders (CustomerID, OrderDate, Status)
    VALUES (@CustomerID, GETDATE(), 'New');

    SET @OrderID = SCOPE_IDENTITY();

    INSERT INTO OrderDetails (OrderID, ProductID, Quantity)
    VALUES (@OrderID, @ProductID, @Quantity);

    EXEC CalculateOrderTotal @OrderID;
    EXEC UpdateInventory @ProductID, @Quantity;
    EXEC SendOrderConfirmation @CustomerID, @OrderID;
END
```

## Example 5: Transaction Handling

```sql
CREATE PROCEDURE TransferFunds
    @FromAccount INT,
    @ToAccount INT,
    @Amount DECIMAL(10,2)
AS
BEGIN
    BEGIN TRANSACTION;

    UPDATE Accounts
    SET Balance = Balance - @Amount
    WHERE AccountID = @FromAccount;

    UPDATE Accounts
    SET Balance = Balance + @Amount
    WHERE AccountID = @ToAccount;

    INSERT INTO TransferLog (FromAccount, ToAccount, Amount, TransferDate)
    VALUES (@FromAccount, @ToAccount, @Amount, GETDATE());

    COMMIT TRANSACTION;
END
```

## Testing Checklist

- [x] SELECT statements with tables
- [x] INSERT statements with tables
- [x] UPDATE statements with tables
- [x] DELETE statements with tables
- [x] EXEC stored procedure calls
- [x] IF/ELSE conditions
- [x] WHILE loops
- [x] Variable declarations
- [x] BEGIN/END blocks
- [x] Transaction handling
- [x] Nested procedure calls
- [x] Comments (should be removed)
