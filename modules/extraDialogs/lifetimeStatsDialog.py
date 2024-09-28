from matplotlib.figure import Figure
import numpy as np
from matplotlib.backends.backend_qt5agg import FigureCanvasQTAgg as FigureCanvas
from PyQt5.QtGui import *
from PyQt5.QtWidgets import *
from PyQt5.QtCore import *


class LifetimeStatsDialog(QDialog):
    def __init__(self, parent, player):
        super().__init__(parent)
        self.player = player
        self.setWindowTitle(f"Lifetime Stats for {player.name}")
        self.setStyleSheet("font-size: 18px;")
        self.layout = QVBoxLayout()

        # Player stats text
        message = (f"Player: {player.name}\n"
                   f"Score: {player.lifetime_score:.2f}\n"
                   f"Games Played: {player.lifetime_games_played}\n"
                   f"Wins: {player.lifetime_wins}\n"
                   f"Losses: {player.lifetime_losses}\n"
                   f"Highest Win Streak: {player.max_win_streak}")
        info_label = QLabel(message)
        self.layout.addWidget(info_label)

        # Add matplotlib figure
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
        ax.set_xticklabels(tick_positions)

        ax.set_title(f"Score Over Time")
        ax.set_xlabel("Number of Games Played")
        ax.set_ylabel("Score")
        ax.grid(True)

        canvas = FigureCanvas(fig)
        self.layout.addWidget(canvas)

        self.setLayout(self.layout)
        self.resize(600, 400)