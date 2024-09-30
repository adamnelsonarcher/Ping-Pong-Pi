import sys
# pyqt_imports.py
from PyQt5.QtGui import QFont, QColor
from PyQt5.QtWidgets import (QWidget, QTableWidget, QVBoxLayout, QHBoxLayout,
                             QTableWidgetItem, QComboBox, QLabel, QPushButton, 
                             QDialog, QInputDialog, QMessageBox, QLineEdit, 
                             QApplication, QHeaderView, QAbstractItemView, QTextEdit)
from PyQt5.QtCore import Qt, QTimer


# pingpong.py
from modules.scoreboardDialog import ScoreboardDialog
from modules.util import Util
from modules.extraDialogs import ExtraDiag

class EloApp(QWidget):
    # init stuff
    def __init__(self):
        super().__init__()
        self.players = {}
        Util.load_players(self)  # Load players at startup
        self.init_timers()
        self.init_ui()
        self.update_dropdowns()
        self.game_history_path = r'game_data/game_history.txt'
        self.update_leaderboard()
        Util.load_game_history(self)
        self.showFullScreen()
        self.game_in_progress = False

    def init_ui(self):
        self.setFont(QFont('Arial', 16))  # Consistent font for better readability

        # Main horizontal layout
        main_layout = QHBoxLayout()

        # Left column for the leaderboard
        left_layout = QVBoxLayout()
        self.leaderboard_table = QTableWidget()
        self.leaderboard_table.setColumnCount(3)
        self.leaderboard_table.setHorizontalHeaderLabels(['Player Name', 'Score', 'W/L Ratio'])
        self.leaderboard_table.cellDoubleClicked.connect(lambda row, column: ExtraDiag.open_lifetime_stats_dialog(row, column, self))
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
        bottom_layout.addStretch()
        self.add_player_button = QPushButton("Add Player")
        self.add_player_button.clicked.connect(lambda: ExtraDiag.open_add_player_dialog(self))
        bottom_layout.addWidget(self.add_player_button)

        self.admin_controls_button = QPushButton("Admin Controls")
        self.admin_controls_button.clicked.connect(lambda: ExtraDiag.open_admin_controls_dialog(self))
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
        self.clear_selection_timer.setInterval(10 * 60 * 1000)  # 10 minutes in milliseconds
        self.clear_selection_timer.setSingleShot(True)
        self.clear_selection_timer.timeout.connect(self.remove_player_selection)
    
    def update_dropdowns(self):
        self.player1_dropdown.clear()
        self.player2_dropdown.clear()

        # Add placeholder as the first item which is not selectable
        dropdown_default = "Select Player"
        self.player1_dropdown.addItem(dropdown_default)
        self.player2_dropdown.addItem(dropdown_default)
        self.player1_dropdown.model().item(0).setEnabled(False)
        self.player2_dropdown.model().item(0).setEnabled(False)

        # Add updated list of player names
        player_names = sorted(self.players.keys())  # Sorting the names alphabetically
        self.player1_dropdown.addItems(player_names)
        self.player2_dropdown.addItems(player_names)

        # Set the current index to the placeholder
        self.player1_dropdown.setCurrentIndex(0)
        self.player2_dropdown.setCurrentIndex(0)

    def remove_player_selection(self):
        # Reset the dropdowns to no selection
        self.player1_dropdown.setCurrentIndex(0) 
        self.player2_dropdown.setCurrentIndex(0)
    
    # events and game end calls
    def start_game(self):
        player1_name = self.player1_dropdown.currentText()
        player2_name = self.player2_dropdown.currentText()
        if player1_name and player2_name and player1_name != player2_name:
            self.game_in_progress = True
            self.scoreboard = ScoreboardDialog(self, player1_name, player2_name)
            self.scoreboard.exec_()
            self.game_in_progress = False
            self.update_leaderboard()

    def keyPressEvent(self, event):
        super().keyPressEvent(event)
        Util.reset_timers(self)

    def update_leaderboard(self):
        self.leaderboard_table.clearContents()
        # Separate active and inactive players
        active_players = {name: player for name, player in self.players.items() if player.active}
        inactive_players = {name: player for name, player in self.players.items() if not player.active}

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

            if player.current_streak >= 3:
                name_with_space += f" 🔥{player.current_streak}"

            name_item = QTableWidgetItem(name_with_space)
            ratio_item = QTableWidgetItem(player.win_loss_ratio())
            if (not player.active):
                score_item = QTableWidgetItem("Unranked")
            else:
                score_item = QTableWidgetItem(f"{player.score:.2f}")
            

            # Align text in the score and ratio columns
            score_item.setTextAlignment(Qt.AlignCenter)
            ratio_item.setTextAlignment(Qt.AlignCenter)

            # Apply styling for inactive players
            if (not player.active):
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
        if ( winner_rank == "Unranked" or loser_rank == "Unranked" ):
            message = f"<b>{winner_name}</b>(Unranked) beat <b>{loser_name}</b>(Unranked) <b>[{winner_score}-{loser_score}]</b>"
            if loser_rank != "Unranked":
                message = f"<b>{winner_name}</b>(Unranked) beat <b>{loser_name}</b> <b>[{winner_score}-{loser_score}]</b>"
            if winner_rank != "Unranked":
                message = f"<b>{winner_name}</b> beat <b>{loser_name}</b>(Unranked) <b>[{winner_score}-{loser_score}]</b>"
        else:
            # message with rank removed v2.2
            # message = f"<b>{winner_name}</b>({winner_rank}) beat <b>{loser_name}</b>({loser_rank}) <b>[{winner_score}-{loser_score}]</b>: {winner_change_text} / {loser_change_text}"
            
            # default message
            message = f"<b>{winner_name}</b> beat <b>{loser_name}</b> <b>[{winner_score}-{loser_score}]</b>: {winner_change_text} / {loser_change_text}"
            # underdog victory
            if (winner_rank > loser_rank+4):
                message  = f"<b>{winner_name}</b> (ranked #{winner_rank}) pulled off an <span style='color:gold;'><b>UNDERDOG VICTORY</b></span> against <b>{loser_name}</b> (ranked #{loser_rank}) [<b>{winner_score} - {loser_score}</b>] : {winner_change_text} / {loser_change_text}"
            # SKUNK
            if( (winner_score == 7 and loser_score == 0) or (winner_score == 11 and loser_score == 1) ):
                message = f"<span style='color:red;'><b>{winner_name}</b> SKUNKED <b>{loser_name}</b> <b>[{winner_score}-{loser_score}]</span></b>: {winner_change_text} / {loser_change_text}"
            

        self.history_display.append(message)

        # self.history_display.append("<hr style='border: 1px solid black;'>")   # horizontal rule after each entry

        with open(self.game_history_path, 'a') as file:
            file.write(f"{message}\n")
        Util.limit_game_history(self)

    # validation
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
        if (player1_name and player2_name) and (player1_name != player2_name) and (player1_name and player2_name != "Select Player"):
            self.start_game_button.setEnabled(True)
        else:
            self.start_game_button.setEnabled(False)

def main():
    app = QApplication(sys.argv)
    ex = EloApp()
    ex.show()
    sys.exit(app.exec_())

if __name__ == '__main__':
    main()
