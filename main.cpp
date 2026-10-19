#include <iostream>
#include <fstream>
#include <iomanip>
#include <string>
using namespace std;

const int MAX = 100;

// Data storage (arrays)
string titles[MAX];
string categories[MAX];
double amounts[MAX];
int expenseCount = 0;

// ---------- Category Selection ----------
string chooseCategory() {
    int choice;
    cout << "1. Food\n2. Transport\n3. Shopping\n4. Bills\n5. Other\n";
    cout << "Choose category: ";
    cin >> choice;
    cin.ignore();

    if (choice == 1) return "Food";
    else if (choice == 2) return "Transport";
    else if (choice == 3) return "Shopping";
    else if (choice == 4) return "Bills";
    else return "Other";
}

// ---------- File Handling ----------
void loadExpenses() {
    ifstream file("expenses.txt");
    if (!file) return;   // no file yet

    while (expenseCount < MAX && getline(file, titles[expenseCount])) {
        getline(file, categories[expenseCount]);
        file >> amounts[expenseCount];
        file.ignore();
        expenseCount++;
    }
    file.close();
}

void saveExpenses() {
    ofstream file("expenses.txt");
    for (int i = 0; i < expenseCount; i++) {
        file << titles[i] << endl;
        file << categories[i] << endl;
        file << amounts[i] << endl;
    }
    file.close();
}

// ---------- Calculations ----------
double calculateTotal() {
    double total = 0;
    for (int i = 0; i < expenseCount; i++) {
        total += amounts[i];
    }
    return total;
}

double categoryTotal(string cat) {
    double total = 0;
    for (int i = 0; i < expenseCount; i++) {
        if (categories[i] == cat) {
            total += amounts[i];
        }
    }
    return total;
}

// ---------- Generate the HTML Page ----------
void generateHTML() {
    ofstream file("index.html");
    file << fixed << setprecision(2);

    file << "<!DOCTYPE html>\n<html>\n<head>\n";
    file << "  <title>Expense Tracker</title>\n";
    file << "  <link rel='stylesheet' href='style.css'>\n";
    file << "</head>\n<body>\n";
    file << "  <div class='container'>\n";
    file << "    <h1>Expense Tracker</h1>\n";

    // Summary cards
    file << "    <div class='cards'>\n";
    file << "      <div class='card total'><h3>Total</h3><p>$" << calculateTotal() << "</p></div>\n";
    file << "      <div class='card'><h3>Food</h3><p>$" << categoryTotal("Food") << "</p></div>\n";
    file << "      <div class='card'><h3>Transport</h3><p>$" << categoryTotal("Transport") << "</p></div>\n";
    file << "      <div class='card'><h3>Shopping</h3><p>$" << categoryTotal("Shopping") << "</p></div>\n";
    file << "      <div class='card'><h3>Bills</h3><p>$" << categoryTotal("Bills") << "</p></div>\n";
    file << "      <div class='card'><h3>Other</h3><p>$" << categoryTotal("Other") << "</p></div>\n";
    file << "    </div>\n";

    // Table
    file << "    <table>\n";
    file << "      <tr><th>#</th><th>Title</th><th>Category</th><th>Amount</th></tr>\n";
    for (int i = 0; i < expenseCount; i++) {
        file << "      <tr><td>" << i + 1 << "</td><td>" << titles[i]
             << "</td><td>" << categories[i]
             << "</td><td>$" << amounts[i] << "</td></tr>\n";
    }
    file << "    </table>\n";

    if (expenseCount == 0) {
        file << "    <p class='empty'>No expenses yet.</p>\n";
    }

    file << "  </div>\n</body>\n</html>\n";
    file.close();
}

// ---------- Menu Functions ----------
void addExpense() {
    if (expenseCount >= MAX) {
        cout << "Storage full!\n";
        return;
    }

    cout << "Enter title: ";
    getline(cin, titles[expenseCount]);

    categories[expenseCount] = chooseCategory();

    cout << "Enter amount: ";
    cin >> amounts[expenseCount];
    cin.ignore();

    expenseCount++;
    saveExpenses();
    generateHTML();
    cout << "Expense added!\n";
}

void viewExpenses() {
    if (expenseCount == 0) {
        cout << "No expenses yet.\n";
        return;
    }
    cout << "\n--- All Expenses ---\n";
    for (int i = 0; i < expenseCount; i++) {
        cout << i + 1 << ". " << titles[i] << " | "
             << categories[i] << " | $" << amounts[i] << endl;
    }
    cout << "Total: $" << calculateTotal() << endl;
}

void deleteExpense() {
    int num;
    viewExpenses();
    if (expenseCount == 0) return;

    cout << "Enter number to delete: ";
    cin >> num;
    cin.ignore();

    if (num < 1 || num > expenseCount) {
        cout << "Invalid number!\n";
        return;
    }

    // shift everything after it one step back
    for (int i = num - 1; i < expenseCount - 1; i++) {
        titles[i] = titles[i + 1];
        categories[i] = categories[i + 1];
        amounts[i] = amounts[i + 1];
    }
    expenseCount--;

    saveExpenses();
    generateHTML();
    cout << "Expense deleted!\n";
}

void showMenu() {
    cout << "\n===== EXPENSE TRACKER =====\n";
    cout << "1. Add Expense\n";
    cout << "2. View Expenses\n";
    cout << "3. Delete Expense\n";
    cout << "4. Exit\n";
    cout << "Choose: ";
}

// ---------- Main ----------
int main() {
    int choice;

    loadExpenses();
    generateHTML();

    do {
        showMenu();
        cin >> choice;
        cin.ignore();

        if (choice == 1) addExpense();
        else if (choice == 2) viewExpenses();
        else if (choice == 3) deleteExpense();
        else if (choice == 4) cout << "Goodbye! Open index.html to see your tracker.\n";
        else cout << "Invalid choice!\n";

    } while (choice != 4);

    return 0;
}