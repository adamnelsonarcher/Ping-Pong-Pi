# __init__.py
from PyQt5.QtWidgets import (QDialog, QInputDialog, QLineEdit)

from .addPlayerDialog import AddPlayerDialog
from .adminControlsDialog import AdminControlsDialog
from .lifetimeStatsDialog import LifetimeStatsDialog

import settings


class ExtraDiag:
    def open_lifetime_stats_dialog(row, column, parent):
        player_name = parent.leaderboard_table.item(row, 0).text().strip()  # Get player name from leaderboard table
        if "🔥" in player_name:
            player_name = player_name.split("🔥")[0].strip()
            
        if player_name in parent.players:
            player = parent.players[player_name]
            dialog = LifetimeStatsDialog(parent, player)
            dialog.exec_()

    def open_add_player_dialog(parent):
        dialog = AddPlayerDialog(parent)
        if dialog.exec_() == QDialog.Accepted:
            new_name, new_password = dialog.get_player_data()
            if new_name and new_password:
                AddPlayerDialog.add_new_player(parent, new_name, new_password)

    def open_admin_controls_dialog(parent, add_player_button):
        password, ok = QInputDialog.getText(parent, 'Admin Login', 'Enter admin password:', QLineEdit.Password)
        if ok and password == settings.ADMIN_PASSWORD:
            dialog = AdminControlsDialog(parent, add_player_button)
            dialog.set_players(parent.players)
            dialog.exec_()
