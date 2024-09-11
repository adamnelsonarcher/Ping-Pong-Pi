import sys
from PyQt5.QtGui import *
from PyQt5.QtWidgets import *
from PyQt5.QtCore import *
from matplotlib.backends.backend_qt5agg import FigureCanvasQTAgg as FigureCanvas
from matplotlib.figure import Figure
import numpy as np
import os

# pingpong.py
from modules.player import Player
from modules.adminControls import AdminControlsDialog
from modules.addPlayer import AddPlayerDialog
from modules.scoreboardDialog import ScoreboardDialog

class EloApp(QWidget):
    def __init__(self):
        super().__init__()
        self.players = {}
        self.load_players()  # Load players at startup
        # self.init_timers()
        self.init_ui()
        self.update_dropdowns()
        self.game_history_path = 'game_history.txt'
        self.update_leaderboard()
        self.load_game_history()
        self.showFullScreen()
        self.game_in_progress = False

    def load_game_history(self):
        # Optionally clear existing content
        self.history_display.clear()

        # Set a title for the history display using HTML
        self.history_display.setHtml("<h2>Game History</h2>")

        # Load existing history from a file
        try:
            with open('game_history.txt', 'r') as file:
                entries = file.readlines()

            for entry in entries:
                self.update_history_from_file(entry.strip())
        except FileNotFoundError:
            print("History file not found. Starting with an empty history.")

    def keyPressEvent(self, event):
        key = event.key()
        if key == Qt.Key_2 and not self.game_in_progress:  # Start game on key press "2"
            self.validate_selections()
            self.start_game()

    def get_sorted_players(self):
        # Return a list of players sorted by score in descending order
        sorted_players = sorted(self.players.items(), key=lambda x: -x[1].score)
        return sorted_players

    def load_players(self):
        filepath = 'players.txt'  # Ensure this is the correct path
        try:
            with open(filepath, 'r') as file:
                for line in file:
                    parts = line.strip().split(',')
                    name = parts[0]
                    score = float(parts[1])  # Convert score to float
                    games_played = int(parts[2])
                    wins = int(parts[3])
                    losses = int(parts[4])
                    password = parts[5]
                    lifetime_games_played = int(parts[6])
                    lifetime_wins = int(parts[7])
                    lifetime_losses = int(parts[8])
                    lifetime_score = float(parts[9])
                    if name not in self.players:
                        self.players[name] = Player(name, score, password)
                        self.players[name].games_played = games_played
                        self.players[name].wins = wins
                        self.players[name].losses = losses

                        self.players[name].lifetime_games_played = lifetime_games_played
                        self.players[name].lifetime_wins = lifetime_wins
                        self.players[name].lifetime_losses = lifetime_losses
                        self.players[name].lifetime_score = lifetime_score
        except FileNotFoundError:
            print(f"No existing player data file found at {filepath}. Starting with an empty player list.")
        except Exception as e:
            print(f"Error loading players from {filepath}: {e}")
        if not os.path.exists('score_history.txt'):
            print("Score history file does not exist, starting fresh.")
            return
        try:
            with open('score_history.txt', 'r') as file:
                for line in file:
                    parts = line.strip().split(',')
                    name = parts[0]
                    scores = list(map(float, parts[1:]))
                    if name in self.players:
                        self.players[name].score_history = scores
            print("Score history loaded successfully.")
        except Exception as e:
            print(f"Failed to load score history: {e}")

    def save_players(self):
        try:
            with open('players.txt', 'w') as file:
                for player in self.players.values():
                    file.write(
                        f"{player.name},{player.score},{player.games_played},{player.wins},{player.losses},{player.password},{player.lifetime_games_played},{player.lifetime_wins},{player.lifetime_losses},{player.lifetime_score:.2f}\n")
            print("Players saved successfully.")  # Debug print
        except Exception as e:
            print(f"Failed to save players: {e}")
        try:
            with open('score_history.txt', 'w') as file:
                for name, player in self.players.items():
                    # Write the player's name followed by their score history
                    scores = ','.join(map(str, player.score_history))
                    file.write(f"{name},{scores}\n")
            print("Score history saved successfully.")
        except Exception as e:
            print(f"Failed to save score history: {e}")

    def add_new_player(self):
        new_name = self.new_player_name.text().strip()
        new_password = self.new_player_password.text()
        if new_name and new_name not in self.players and new_password:
            self.players[new_name] = Player(new_name, password=new_password)
            self.update_dropdowns()
            self.update_leaderboard()
            self.save_players()  # Save players after adding a new one
            self.new_player_name.clear()
            self.new_player_password.clear()
        else:
            self.history_display.append("Invalid name, password or player already exists.")

    def update_dropdowns(self):
        self.player1_dropdown.clear()
        self.player2_dropdown.clear()

        # Add placeholder as the first item which is not selectable
        self.player1_dropdown.addItem("Select Player")
        self.player2_dropdown.addItem("Select Player")
        self.player1_dropdown.model().item(0).setEnabled(False)
        self.player2_dropdown.model().item(0).setEnabled(False)

        # Add updated list of player names
        player_names = sorted(self.players.keys())  # Sorting the names alphabetically
        self.player1_dropdown.addItems(player_names)
        self.player2_dropdown.addItems(player_names)

        # Set the current index to the placeholder
        self.player1_dropdown.setCurrentIndex(0)
        self.player2_dropdown.setCurrentIndex(0)

    def validate_player(self, player_name):
        if player_name in self.players:
            password, ok = QInputDialog.getText(self, 'Password Check', 'Enter password for ' + player_name,
                                                QLineEdit.Password)
            if ok and password == self.players[player_name].password:
                return True
            else:
                QMessageBox.warning(self, 'Incorrect Password', 'The password entered is incorrect.', QMessageBox.Ok)
        return False

    def on_player1_selection(self, index):
        if index <= 0:  # Adjust according to your index for 'Select Player'
            return  # Ignore when no player is selected or placeholder is selected
        player_name = self.player1_dropdown.currentText()
        if player_name and not self.validate_player(player_name):
            self.player1_dropdown.setCurrentIndex(-1)  # Reset selection if password fails
        self.validate_selections()

    def on_player2_selection(self, index):
        if index <= 0:  # Adjust according to your index for 'Select Player'
            return  # Ignore when no player is selected or placeholder is selected
        player_name = self.player2_dropdown.currentText()
        if player_name and not self.validate_player(player_name):
            self.player2_dropdown.setCurrentIndex(-1)  # Reset selection if password fails
        self.validate_selections()

    def validate_selections(self):
        player1_name = self.player1_dropdown.currentText()
        player2_name = self.player2_dropdown.currentText()
        if player1_name and player2_name and player1_name != player2_name:
            self.start_game_button.setEnabled(True)
        else:
            self.start_game_button.setEnabled(False)

    def remove_player_selection(self):
        # Reset the dropdowns to no selection
        self.player1_dropdown.setCurrentIndex(0) 
        self.player2_dropdown.setCurrentIndex(0)

    def start_game(self):
        player1_name = self.player1_dropdown.currentText()
        player2_name = self.player2_dropdown.currentText()
        if player1_name and player2_name and player1_name != player2_name:
            self.game_in_progress = True
            self.scoreboard = ScoreboardDialog(self, player1_name, player2_name)
            self.scoreboard.exec_()
            self.game_in_progress = False
            self.update_leaderboard()

    def init_ui(self):
        self.setFont(QFont('Arial', 16))  # Consistent font for better readability

        # Main horizontal layout
        main_layout = QHBoxLayout()

        # Left column for the leaderboard
        left_layout = QVBoxLayout()
        self.leaderboard_table = QTableWidget()
        self.leaderboard_table.setColumnCount(3)
        self.leaderboard_table.setHorizontalHeaderLabels(['Player Name', 'Score', 'W/L Ratio'])
        self.leaderboard_table.cellDoubleClicked.connect(self.display_lifetime_stats)
        # smaller font for the header
        header_font = self.leaderboard_table.horizontalHeader().font()
        header_font.setPointSize(18)  # Adjust the size as needed
        self.leaderboard_table.setStyleSheet(
            "background-color: #F5F5F5; "  # Light grey background
            "color: black; "  # Black text color
            "gridline-color: black;"  # Black grid lines
        )
        self.leaderboard_table.setAlternatingRowColors(True)
        self.leaderboard_table.setStyleSheet(
            self.leaderboard_table.styleSheet() +
            "alternate-background-color: #e8fdff; "  # Light cyan for alternate rows
            "background-color: #FFFFFF; "  # White for regular rows
        )
        self.leaderboard_table.horizontalHeader().setFont(header_font)

        self.leaderboard_table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)

        # larger font for the table data
        data_font = self.leaderboard_table.font()
        data_font.setPointSize(25)
        self.leaderboard_table.setFont(data_font)

        self.leaderboard_table.setEditTriggers(QAbstractItemView.NoEditTriggers)

        left_layout.addWidget(self.leaderboard_table)
        main_layout.addLayout(left_layout, 6)  # 70% of the screen

        # Right column for game history
        right_layout = QVBoxLayout()
        self.history_display = QTextEdit()
        self.history_display.setReadOnly(True)
        self.history_display.setStyleSheet(
            "background-color: #fffce6; "  # Bright yellow background
            "color: black; "  # Black text for contrast
            "border: 1px solid black; "  # Black border
            "padding: 8px; "  # Padding
            "font-size: 20px; "  # Font size
            "font-family: Arial; "  # Font family
        )
        right_layout.addWidget(self.history_display)
        main_layout.addLayout(right_layout, 4)  # 30% of the screen

        # Bottom layout for controls
        bottom_layout = QHBoxLayout()

        # Player selection setup
        self.player1_dropdown = QComboBox()
        self.player2_dropdown = QComboBox()
        bottom_layout.addWidget(QLabel("Player 1:"))
        bottom_layout.addWidget(self.player1_dropdown)
        bottom_layout.addSpacing(50)
        bottom_layout.addWidget(QLabel("Player 2:"))
        bottom_layout.addWidget(self.player2_dropdown)
        bottom_layout.addSpacing(50)

        # Start Game button
        self.start_game_button = QPushButton("Start Game")
        self.start_game_button.clicked.connect(self.start_game)
        bottom_layout.addWidget(self.start_game_button)
        bottom_layout.addSpacing(100)


        self.remove_selection_button = QPushButton("Clear Player Selections")
        self.remove_selection_button.clicked.connect(self.remove_player_selection)
        bottom_layout.addWidget(self.remove_selection_button)

        # Add Player button
        bottom_layout.addStretch();
        self.add_player_button = QPushButton("Add Player")
        self.add_player_button.clicked.connect(self.open_add_player_dialog)
        bottom_layout.addWidget(self.add_player_button)

        self.admin_controls_button = QPushButton("Admin Controls")
        self.admin_controls_button.clicked.connect(self.open_admin_controls_dialog)
        bottom_layout.addWidget(self.admin_controls_button)

        self.start_game_button.setStyleSheet("background-color: #a6ffae; color: black; font-size: 20px;")  # Green
        self.remove_selection_button.setStyleSheet("background-color: #ffa6a6; color: black; font-size: 20px;")  # Red
        self.add_player_button.setStyleSheet("background-color: #9c9cff; color: black; font-size: 20px;")  # Blue
        self.admin_controls_button.setStyleSheet(
            "background-color: #FFC107; color: black; font-size: 20px;")  # Amber for admin controls

        # Combine top and bottom layouts
        top_bottom_layout = QVBoxLayout()
        top_bottom_layout.addLayout(main_layout)
        top_bottom_layout.addLayout(bottom_layout)

        self.setLayout(top_bottom_layout)
        self.setWindowTitle('ELO Ranking System')
        self.update_dropdowns()
        self.update_leaderboard()

        self.player1_dropdown.currentIndexChanged.connect(self.on_player1_selection)
        self.player2_dropdown.currentIndexChanged.connect(self.on_player2_selection)

    def init_timers(self):
        # Timer to clear selections after 7 minutes of inactivity
        self.clear_selection_timer = QTimer(self)
        self.clear_selection_timer.setInterval(5 * 60 * 1000)  # 5 minutes in milliseconds
        self.clear_selection_timer.setSingleShot(True)
        self.clear_selection_timer.timeout.connect(self.remove_player_selection)

    def reset_timers(self):
        try:
            self.clear_selection_timer.start()
        except:
            pass

    # Override keyPressEvent to reset timers on any key press
    def keyPressEvent(self, event):
        super().keyPressEvent(event)
        self.reset_timers()

    def display_lifetime_stats(self, row, column):
        player_name = self.leaderboard_table.item(row, 0).text().strip()
        if player_name in self.players:
            player = self.players[player_name]

            # Create the custom dialog
            dialog = QDialog(self)
            dialog.setWindowTitle(f"Lifetime Stats for {player.name}")
            dialog.setStyleSheet("font-size: 18px;")

            # Create the layout for the dialog
            layout = QVBoxLayout()

            # Add player data to the layout
            message = (f"Player: {player.name}\n"
                    f"Score: {player.lifetime_score:.2f}\n"
                    f"Games Played: {player.lifetime_games_played}\n"
                    f"Wins: {player.lifetime_wins}\n"
                    f"Losses: {player.lifetime_losses}")
            info_label = QLabel(message)
            layout.addWidget(info_label)

            # Create a matplotlib figure and add it to the dialog
            fig = Figure(figsize=(5, 4), dpi=100)
            ax = fig.add_subplot(111)
            ax.plot(range(1, len(player.score_history) + 1), player.score_history, marker='o', linestyle='-', color='b')

            # Set x-axis to show only positive integers starting from 1
            ax.set_xlim(1, len(player.score_history))
            ax.set_xticks(np.arange(1, len(player.score_history) + 1))

            ax.set_title(f"Score Over Time")
            ax.set_xlabel("Number of Games Played")
            ax.set_ylabel("Score")
            ax.grid(True)

            canvas = FigureCanvas(fig)
            layout.addWidget(canvas)

            dialog.setLayout(layout)

            # Resize the dialog to a reasonable size
            dialog.resize(600, 400)

            # Show the dialog
            dialog.exec_()

    def open_admin_controls_dialog(self):
        password, ok = QInputDialog.getText(self, 'Admin Login', 'Enter admin password:', QLineEdit.Password)
        if ok and password == '613668':
            dialog = AdminControlsDialog(self)
            dialog.set_players(self.players)
            dialog.exec_()

    def open_add_player_dialog(self):
        dialog = AddPlayerDialog(self)
        if dialog.exec_() == QDialog.Accepted:
            new_name, new_password = dialog.get_player_data()
            if new_name and new_password:
                self.add_new_player(new_name, new_password)

    def add_new_player(self, name, password):
        if name and name not in self.players and password:
            self.players[name] = Player(name, password=password)
            self.update_dropdowns()
            self.update_leaderboard()
            self.save_players()
        else:
            self.history_display.append("Invalid name, password or player already exists.")

    def update_history_from_file(self, history_entry):
        # Check if this is the first entry
        is_first_entry = not bool(self.history_display.toPlainText().strip())

        # Prepare the entry with or without a leading line
        message = f"<div>{history_entry}</div>"
        #if not is_first_entry:
        #    message = f"<hr/>{message}"  # Add a horizontal line before the message if it's not the first entry

        # Append formatted entry
        self.history_display.append(message)


    def update_leaderboard(self):
        self.leaderboard_table.clearContents()
        # Separate active and inactive players
        active_players = {name: player for name, player in self.players.items() if player.games_played >= 3}
        inactive_players = {name: player for name, player in self.players.items() if player.games_played < 3}

        # Sort active players by score in descending order
        sorted_active_players = sorted(active_players.items(), key=lambda x: -x[1].score)
        
        # Sort inactive players alphabetically by name
        sorted_inactive_players = sorted(inactive_players.items(), key=lambda x: x[0])

        # Combine lists: active players at the top, inactive players at the bottom
        sorted_players = sorted_active_players + sorted_inactive_players

        # Set the number of rows in the leaderboard table
        self.leaderboard_table.setRowCount(len(sorted_players))

        for row, (name, player) in enumerate(sorted_players):
            # Create table items with player details
            name_with_space = f" {name}"
            name_item = QTableWidgetItem(name_with_space)
            ratio_item = QTableWidgetItem(player.win_loss_ratio())
            if player.games_played < 3:
                score_item = QTableWidgetItem("Unranked")
            else:
                score_item = QTableWidgetItem(f"{player.score:.2f}")
            

            # Align text in the score and ratio columns
            score_item.setTextAlignment(Qt.AlignCenter)
            ratio_item.setTextAlignment(Qt.AlignCenter)

            # Apply styling for inactive players
            if player.games_played < 3:
                for item in (name_item, score_item, ratio_item):
                    item.setForeground(QColor('lightGray'))
                    item.setFont(QFont('Arial', 25, QFont.StyleItalic))

            # Set items in the table
            self.leaderboard_table.setItem(row, 0, name_item)
            self.leaderboard_table.setItem(row, 1, score_item)
            self.leaderboard_table.setItem(row, 2, ratio_item)


        # Manually set the row height after populating the table
        row_height = 80  # Adjust this value as needed
        for row in range(self.leaderboard_table.rowCount()):
            # print(f"setting row height for row {row}")
            self.leaderboard_table.setRowHeight(row, row_height)

    def update_history(self, player1_name, player2_name, winner_name, player1_score_change, player2_score_change, player_ranks):
        # Get pre-match ranks for the players involved
        winner_rank = player_ranks.get(winner_name, "Unranked")
        loser_name = player2_name if winner_name == player1_name else player1_name
        loser_rank = player_ranks.get(loser_name, "Unranked")

        # winner_rank = player_ranks[winner_name]
        # loser_name = player2_name if winner_name == player1_name else player1_name
        # loser_rank = player_ranks[loser_name]

        winner_change = round(player1_score_change if winner_name == player1_name else player2_score_change, 2)
        loser_change = round(player2_score_change if winner_name == player1_name else player1_score_change, 2)
        winner_change_text = f"+{winner_change}" if winner_change > 0 else f"{winner_change}"
        loser_change_text = f"+{loser_change}" if loser_change > 0 else f"{loser_change}"
        winner_score = self.scoreboard.player1_score if winner_name == self.scoreboard.player1_name else self.scoreboard.player2_score
        loser_score = self.scoreboard.player2_score if loser_name == self.scoreboard.player2_name else self.scoreboard.player1_score

        # Ensure names are bold in the history text and include score
        # Check if either player is unranked
        if winner_rank == "Unranked" or loser_rank == "Unranked":
            # Only display the winner, loser, and the final score
            message = f"<b>{winner_name}</b>({winner_rank}) beat <b>{loser_name}</b>({loser_rank}) <b>[{winner_score}-{loser_score}]</b>"
        else:
            message = f"<b>{winner_name}</b>({winner_rank}) beat <b>{loser_name}</b>({loser_rank}) <b>[{winner_score}-{loser_score}]</b>: {winner_change_text} / {loser_change_text}"

        self.history_display.append(message)

        with open(self.game_history_path, 'a') as file:
            file.write(f"{message}\n")
        self.limit_game_history()

    def limit_game_history(self):
        try:
            with open(self.game_history_path, 'r') as file:
                lines = file.readlines()

            # Keep only the last 30 entries
            if len(lines) > 30:
                with open(self.game_history_path, 'w') as file:
                    file.writelines(lines[-30:])

        except FileNotFoundError:
            # Create the file if it doesn't exist
            open(self.game_history_path, 'w').close()

def main():
    app = QApplication(sys.argv)
    ex = EloApp()
    ex.show()
    sys.exit(app.exec_())

if __name__ == '__main__':
    main()
