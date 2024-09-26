import sys
from PyQt5.QtGui import *
from PyQt5.QtWidgets import *
from PyQt5.QtCore import *
from matplotlib.backends.backend_qt5agg import FigureCanvasQTAgg as FigureCanvas
from matplotlib.figure import Figure
import numpy as np

# pingpong.py
from modules.adminControls import AdminControlsDialog
from modules.scoreboardDialog import ScoreboardDialog
from modules.util import Util
from modules.addPlayer import *

class EloApp(QWidget):
    # init stuff
    def __init__(self):
        super().__init__()
        self.players = {}
        Util.load_players(self)  # Load players at startup
        self.init_timers()
        self.init_ui()
        self.update_dropdowns()
        self.game_history_path = r'game_data\game_history.txt'
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
        bottom_layout.addStretch()
        self.add_player_button = QPushButton("Add Player")
        self.add_player_button.clicked.connect(lambda: open_add_player_dialog(self))
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

    def remove_player_selection(self):
        # Reset the dropdowns to no selection
        self.player1_dropdown.setCurrentIndex(0) 
        self.player2_dropdown.setCurrentIndex(0)

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
                    f"Losses: {player.lifetime_losses}\n"
                    f"*games before being ranked are not counted")
            info_label = QLabel(message)
            layout.addWidget(info_label)

            # Create a matplotlib figure and add it to the dialog
            fig = Figure(figsize=(5, 4), dpi=100)
            ax = fig.add_subplot(111)
            ax.plot(range(1, len(player.score_history) + 1), player.score_history, marker='o', linestyle='-', color='b')

            # Set x-axis to show only positive integers starting from 1
            ax.set_xlim(1, len(player.score_history))
            ax.set_xticks(np.arange(1, len(player.score_history) + 1))
            ax.set_xlim(1, len(player.score_history))

            # Calculate the tick positions
            num_ticks = 4
            tick_positions = np.linspace(1, len(player.score_history), num_ticks).astype(int)

            # Set the ticks at calculated positions
            ax.set_xticks(tick_positions)

            # Optionally set the x-tick labels (if needed)
            ax.set_xticklabels(tick_positions)

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

    # dialogs
    def open_admin_controls_dialog(self):
        password, ok = QInputDialog.getText(self, 'Admin Login', 'Enter admin password:', QLineEdit.Password)
        if ok and password == '613668':
            dialog = AdminControlsDialog(self)
            dialog.set_players(self.players)
            dialog.exec_()

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
            message = f"<b>{winner_name}</b> beat <b>{loser_name}</b> <b>[{winner_score}-{loser_score}]</b>: {winner_change_text} / {loser_change_text}"

        self.history_display.append(message)

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
