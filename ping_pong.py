import sys
from PyQt5.QtGui import *
from PyQt5.QtWidgets import *
from PyQt5.QtCore import *

class Player:
    def __init__(self, name, score=1000, password=""):
        self.name = name
        self.score = score
        self.games_played = 0
        self.wins = 0
        self.losses = 0
        self.password = password

    def update_score(self, opponent, won):
        K = 100  # Maximum change per game
        result = 1 if won else 0
        expected_score = 1 / ( 1 + 10 ** ((opponent.score - self.score) / 400) )
        score_change = K * (result - expected_score)
        self.score += score_change
        self.games_played += 1
        if won:
            self.wins += 1
        else:
            self.losses += 1
        return score_change  # Return the score change for history update

    def win_loss_ratio(self):
        if self.games_played == 0:
            return "0/0"
        return f"{self.wins}/{self.losses}"

class AdminControlsDialog(QDialog):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle('Admin Controls')

        self.layout = QVBoxLayout()

        # Edit player password
        self.layout.addWidget(QLabel('Edit Player Password'))
        self.player_password_dropdown = QComboBox()
        self.layout.addWidget(self.player_password_dropdown)
        self.new_password_input = QLineEdit()
        self.new_password_input.setPlaceholderText('New Password')
        self.new_password_input.setEchoMode(QLineEdit.Password)
        self.layout.addWidget(self.new_password_input)
        self.edit_password_button = QPushButton('Edit Password')
        self.edit_password_button.clicked.connect(self.edit_player_password)
        self.layout.addWidget(self.edit_password_button)

        # Edit player score
        self.layout.addWidget(QLabel('Edit Player Score'))
        self.player_score_dropdown = QComboBox()
        self.layout.addWidget(self.player_score_dropdown)
        self.new_score_input = QLineEdit()
        self.new_score_input.setPlaceholderText('New Score')
        self.layout.addWidget(self.new_score_input)
        self.edit_score_button = QPushButton('Edit Score')
        self.edit_score_button.clicked.connect(self.edit_player_score)
        self.layout.addWidget(self.edit_score_button)

        # Delete player
        self.layout.addWidget(QLabel('Delete Player'))
        self.player_delete_dropdown = QComboBox()
        self.layout.addWidget(self.player_delete_dropdown)
        self.delete_player_button = QPushButton('Delete Player')
        self.delete_player_button.clicked.connect(self.delete_player)
        self.layout.addWidget(self.delete_player_button)

        # Reset all scores
        self.reset_button = QPushButton('Reset All Scores')
        self.reset_button.clicked.connect(self.reset_all_scores)
        self.layout.addWidget(self.reset_button)

        self.setLayout(self.layout)

    def set_players(self, players):
        player_names = sorted(players.keys())
        self.player_password_dropdown.addItems(player_names)
        self.player_score_dropdown.addItems(player_names)
        self.player_delete_dropdown.addItems(player_names)

    def edit_player_password(self):
        player_name = self.player_password_dropdown.currentText()
        new_password = self.new_password_input.text().strip()
        if player_name and new_password:
            self.parent().players[player_name].password = new_password
            self.parent().save_players()
            self.new_password_input.clear()

    def edit_player_score(self):
        player_name = self.player_score_dropdown.currentText()
        try:
            new_score = float(self.new_score_input.text().strip())
            if player_name:
                self.parent().players[player_name].score = new_score
                self.parent().save_players()
                self.parent().update_leaderboard()
                self.new_score_input.clear()
        except ValueError:
            pass

    def delete_player(self):
        player_name = self.player_delete_dropdown.currentText()
        if player_name:
            del self.parent().players[player_name]
            self.parent().save_players()
            self.parent().update_dropdowns()
            self.parent().update_leaderboard()

    def reset_all_scores(self):
        for player in self.parent().players.values():
            player.score = 1000
            player.games_played = 0
            player.wins = 0
            player.losses = 0
        self.parent().save_players()
        self.parent().update_leaderboard()

class AddPlayerDialog(QDialog):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle('Add New Player')

        self.layout = QVBoxLayout()

        self.name_label = QLabel('Player Name:')
        self.layout.addWidget(self.name_label)
        self.name_input = QLineEdit()
        self.layout.addWidget(self.name_input)

        self.password_label = QLabel('Password:')
        self.layout.addWidget(self.password_label)
        self.password_input = QLineEdit()
        self.password_input.setEchoMode(QLineEdit.Password)
        self.layout.addWidget(self.password_input)

        self.add_button = QPushButton('Add Player')
        self.add_button.clicked.connect(self.accept)
        self.layout.addWidget(self.add_button)

        self.setLayout(self.layout)

    def get_player_data(self):
        return self.name_input.text().strip(), self.password_input.text()

class EloApp(QWidget):
    def __init__(self):
        super().__init__()
        self.players = {}
        self.load_players()  # Load players at startup
        self.init_timers()
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
                    if name not in self.players:
                        self.players[name] = Player(name, score, password)
                        self.players[name].games_played = games_played
                        self.players[name].wins = wins
                        self.players[name].losses = losses
        except FileNotFoundError:
            print(f"No existing player data file found at {filepath}. Starting with an empty player list.")
        except Exception as e:
            print(f"Error loading players from {filepath}: {e}")

    def save_players(self):
        try:
            with open('players.txt', 'w') as file:
                for player in self.players.values():
                    file.write(
                        f"{player.name},{player.score},{player.games_played},{player.wins},{player.losses},{player.password}\n")
            print("Players saved successfully.")  # Debug print
        except Exception as e:
            print(f"Failed to save players: {e}")

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
        self.player1_dropdown.setCurrentIndex(0)  # Assumes 0 is the 'Select Player' placeholder
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
        self.clear_selection_timer.setInterval(7 * 60 * 1000)  # 7 minutes in milliseconds
        self.clear_selection_timer.setSingleShot(True)
        self.clear_selection_timer.timeout.connect(self.clear_player_selections)

    def reset_timers(self):
        self.clear_selection_timer.start()

    def clear_player_selections(self):
        self.player1_dropdown.setCurrentIndex(0)
        self.player2_dropdown.setCurrentIndex(0)

    # Override keyPressEvent to reset timers on any key press
    def keyPressEvent(self, event):
        super().keyPressEvent(event)
        self.reset_timers()

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

    def set_winner(self):
        player1_name = self.player1_dropdown.currentText()
        player2_name = self.player2_dropdown.currentText()
        if player1_name != player2_name:
            # Capture current rankings before updating any scores
            sorted_players = self.get_sorted_players()
            player_ranks = {name: rank + 1 for rank, (name, player) in enumerate(sorted_players)}

            # Assume player 1 is winner for example
            winner_name = self.player1_dropdown.currentText()
            loser_name = self.player2_dropdown.currentText()
            player1 = self.players[player1_name]
            player2 = self.players[player2_name]

            # Perform score updates
            player1_score_change = player1.update_score(player2, True)
            player2_score_change = player2.update_score(player1, False)

            # Update leaderboard to reflect new scores
            self.update_leaderboard()

            # Update history with rankings from before the match
            self.update_history(player1_name, player2_name, winner_name, player1_score_change, player2_score_change,
                                player_ranks)

            # Save updated player information
            self.save_players()

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
        active_players = {name: player for name, player in self.players.items() if player.games_played > 0}
        inactive_players = {name: player for name, player in self.players.items() if player.games_played == 0}

        # Sort active players by score
        sorted_active_players = sorted(active_players.items(), key=lambda x: -x[1].score)
        sorted_inactive_players = sorted(inactive_players.items(), key=lambda x: x[0])  # Alphabetical for inactive

        # Combine lists
        sorted_players = sorted_active_players + sorted_inactive_players

        self.leaderboard_table.setRowCount(len(self.players))
        for row, (name, player) in enumerate(sorted_players):
            # Create table items
            name_with_space = f" {name}"
            name_item = QTableWidgetItem(name_with_space)
            score_item = QTableWidgetItem(f"{player.score:.2f}")
            ratio_item = QTableWidgetItem(player.win_loss_ratio())

            # Align text in the score and ratio columns
            score_item.setTextAlignment(Qt.AlignCenter)
            ratio_item.setTextAlignment(Qt.AlignCenter)

            # Apply styling for inactive players
            if player.games_played == 0:
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
        winner_rank = player_ranks[winner_name]
        loser_name = player2_name if winner_name == player1_name else player1_name
        loser_rank = player_ranks[loser_name]

        winner_change = round(player1_score_change if winner_name == player1_name else player2_score_change, 2)
        loser_change = round(player2_score_change if winner_name == player1_name else player1_score_change, 2)
        winner_change_text = f"+{winner_change}" if winner_change > 0 else f"{winner_change}"
        loser_change_text = f"+{loser_change}" if loser_change > 0 else f"{loser_change}"

        # Ensure names are bold in the history text and include score
        winner_score = self.scoreboard.player1_score if winner_name == self.scoreboard.player1_name else self.scoreboard.player2_score
        loser_score = self.scoreboard.player2_score if loser_name == self.scoreboard.player2_name else self.scoreboard.player1_score
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

class ScoreboardDialog(QDialog):
    def __init__(self, parent, player1_name, player2_name):
        super().__init__(parent)
        self.player1_name = player1_name
        self.player2_name = player2_name
        self.player1_score = 0
        self.player2_score = 0

        self.end_game_confirmation = False
        self.start_game_confirmation = False
        self.quit_game_confirmation = False

        self.setWindowTitle('Game Scoreboard')
        self.setStyleSheet("background-color: #282C34; color: #FFFFFF;")

        screen = QDesktopWidget().screenGeometry()
        self.showFullScreen()
        '''self.setGeometry(0, 0, screen.width(), int(screen.height()*0.8))'''

        # Main layout
        self.layout = QVBoxLayout()
        self.setLayout(self.layout)

        # Players layout
        players_layout = QHBoxLayout()
        self.layout.addLayout(players_layout)

        # Player 1 section
        self.player1_group = QGroupBox()
        # self.player1_group.setStyleSheet("border: 2px solid white;")
        self.player1_group.setStyleSheet("border: 2px solid white; background-color: #4CAF50;")  # Green for Player 1
        self.player1_section = QVBoxLayout()
        self.player1_group.setLayout(self.player1_section)
        players_layout.addWidget(self.player1_group)

        self.player1_label = QLabel(f"{self.player1_name}")
        self.player1_label.setStyleSheet("font-size: 88px; font-weight: bold;")
        self.player1_label.setAlignment(Qt.AlignCenter)
        self.player1_label.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Expanding)

        self.player1_score_label = QLabel(f"{self.player1_score}")
        self.player1_score_label.setStyleSheet("font-size: 296px; font-weight: bold;")
        self.player1_score_label.setAlignment(Qt.AlignCenter)
        self.player1_score_label.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Expanding)

        self.player1_section.addWidget(self.player1_label, 1)  # 20% for name
        self.player1_section.addWidget(self.player1_score_label, 4)  # 80% for score

        self.player1_button_layout = QHBoxLayout()
        self.player1_section.addLayout(self.player1_button_layout)

        self.player1_add_button = QPushButton("+1")
        self.player1_add_button.setStyleSheet("font-size: 32px; background-color: #4CAF50; color: white;")
        self.player1_add_button.clicked.connect(lambda: self.update_score(self.player1_name, 1))
        self.player1_button_layout.addWidget(self.player1_add_button)

        self.player1_sub_button = QPushButton("-1")
        self.player1_sub_button.setStyleSheet("font-size: 32px; background-color: #F44336; color: white;")
        self.player1_sub_button.clicked.connect(lambda: self.update_score(self.player1_name, -1))
        self.player1_button_layout.addWidget(self.player1_sub_button)

        # Player 2 section
        self.player2_group = QGroupBox()
        # self.player2_group.setStyleSheet("border: 2px solid white;")
        self.player2_group.setStyleSheet("border: 2px solid white; background-color: #2196F3;")  # Blue for Player 2
        self.player2_section = QVBoxLayout()
        self.player2_group.setLayout(self.player2_section)
        players_layout.addWidget(self.player2_group)

        self.player2_label = QLabel(f"{self.player2_name}")
        self.player2_label.setStyleSheet("font-size: 88px; font-weight: bold;")
        self.player2_label.setAlignment(Qt.AlignCenter)
        self.player2_label.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Expanding)

        self.player2_score_label = QLabel(f"{self.player2_score}")
        self.player2_score_label.setStyleSheet("font-size: 296px; font-weight: bold;")
        self.player2_score_label.setAlignment(Qt.AlignCenter)
        self.player2_score_label.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Expanding)

        self.player2_section.addWidget(self.player2_label, 1)  # 20% for name
        self.player2_section.addWidget(self.player2_score_label, 4)  # 80% for score

        self.player2_button_layout = QHBoxLayout()
        self.player2_section.addLayout(self.player2_button_layout)

        self.player2_add_button = QPushButton("+1")
        self.player2_add_button.setStyleSheet("font-size: 32px; background-color: #4CAF50; color: white;")
        self.player2_add_button.clicked.connect(lambda: self.update_score(self.player2_name, 1))
        self.player2_button_layout.addWidget(self.player2_add_button)

        self.player2_sub_button = QPushButton("-1")
        self.player2_sub_button.setStyleSheet("font-size: 32px; background-color: #F44336; color: white;")
        self.player2_sub_button.clicked.connect(lambda: self.update_score(self.player2_name, -1))
        self.player2_button_layout.addWidget(self.player2_sub_button)

        # Control buttons
        self.control_button_layout = QHBoxLayout()
        self.layout.addLayout(self.control_button_layout)

        self.control_button_layout.addStretch()

        self.end_game_button = QPushButton("End Game")
        self.end_game_button.setStyleSheet("font-size: 24px; background-color: #2196F3; color: white;")
        self.end_game_button.clicked.connect(self.end_game)
        self.control_button_layout.addWidget(self.end_game_button)

        self.quit_game_button = QPushButton("Quit Game")
        self.quit_game_button.setStyleSheet("font-size: 24px; background-color: #9E9E9E; color: white;")
        self.quit_game_button.clicked.connect(self.quit_game)
        self.control_button_layout.addWidget(self.quit_game_button)

        self.control_button_layout.addStretch()

        # Message label for temporary messages
        self.message_label = QLabel("")
        self.message_label.setAlignment(Qt.AlignCenter)
        self.message_label.setStyleSheet("font-size: 24px; color: yellow;")
        self.layout.addWidget(self.message_label)
        
        self.setFocusPolicy(Qt.StrongFocus)
        self.activateWindow()
        self.setFocus()

    def update_score(self, player_name, delta):
        if player_name == self.player1_name:
            self.player1_score += delta
            self.player1_score = max(0, self.player1_score)  # Ensure score doesn't go below 0
            self.player1_score_label.setText(f"{self.player1_score}")
        else:
            self.player2_score += delta
            self.player2_score = max(0, self.player2_score)  # Ensure score doesn't go below 0
            self.player2_score_label.setText(f"{self.player2_score}")

    def keyPressEvent(self, event):
        key = event.key()
        parent = self.parent()  # Access the parent class instance

        if key == Qt.Key_1:  # End game
            if self.end_game_confirmation:
                self.end_game()
                self.end_game_confirmation = False
            else:
                self.show_temp_message('Press End Game (1) again to confirm')
                self.end_game_confirmation = True
                QTimer.singleShot(2000, self.reset_end_game_confirmation)
        elif key == Qt.Key_2:  # Start game
            if not parent.game_in_progress:  # Only start game if no game is in progress
                self.show_temp_message('Starting new game')
                parent.start_game()
            else:
                self.show_temp_message('Game already in progress')
        elif key == Qt.Key_3:  # Quit game
            if self.quit_game_confirmation:
                self.quit_game()
                self.quit_game_confirmation = False
            else:
                self.show_temp_message('Press Quit Game (3) again to confirm')
                self.quit_game_confirmation = True
                QTimer.singleShot(2000, self.reset_quit_game_confirmation)
        elif key == Qt.Key_4:  # Player 2, +1
            self.update_score(self.player2_name, 1)
        elif key == Qt.Key_5:  # Player 2, -1
            self.update_score(self.player2_name, -1)
        elif key == Qt.Key_7:  # Player 1, +1
            self.update_score(self.player1_name, 1)
        elif key == Qt.Key_8:  # Player 1, -1
            self.update_score(self.player1_name, -1)

    def show_temp_message(self, message):
        self.message_label.setText(message)
        QTimer.singleShot(2000, self.clear_temp_message)  # Clear message after 2 seconds

    def clear_temp_message(self):
        self.message_label.setText("")

    def reset_end_game_confirmation(self):
        self.end_game_confirmation = False

    def reset_start_game_confirmation(self):
        self.start_game_confirmation = False

    def reset_quit_game_confirmation(self):
        self.quit_game_confirmation = False

    def start_game(self):
        QMessageBox.information(self, 'Game Started', 'The game has started.')

    def end_game(self):
        parent = self.parent()
        player1 = parent.players[self.player1_name]
        player2 = parent.players[self.player2_name]

        # Capture current rankings before updating any scores
        sorted_players = parent.get_sorted_players()
        player_ranks = {name: rank + 1 for rank, (name, player) in enumerate(sorted_players)}

        if self.player1_score > self.player2_score:
            player1_score_change = player1.update_score(player2, True)
            player2_score_change = player2.update_score(player1, False)
            parent.update_history(self.player1_name, self.player2_name, self.player1_name, player1_score_change, player2_score_change, player_ranks)
        elif self.player2_score > self.player1_score:
            player1_score_change = player1.update_score(player2, False)
            player2_score_change = player2.update_score(player1, True)
            parent.update_history(self.player1_name, self.player2_name, self.player2_name, player1_score_change, player2_score_change, player_ranks)
        else:
            # Handle tie separately if required
            parent.history_display.append(f"Game between <b>{self.player1_name}</b> and <b>{self.player2_name}</b> ended in a tie with score {self.player1_score} to {self.player2_score}")

        parent.save_players()
        parent.update_leaderboard()
        self.close()

    def quit_game(self):
        self.parent().history_display.append(f"Game between <b>{self.player1_name}</b> and <b>{self.player2_name}</b> was quit without a winner")
        self.close()


def main():
    app = QApplication(sys.argv)
    ex = EloApp()
    ex.show()
    sys.exit(app.exec_())

if __name__ == '__main__':
    main()
