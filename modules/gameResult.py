# gameResult.py
import settings


class GameResult:
    def __init__(self, player1, player2, player1_name, player2_name, player1_score, player2_score, players):
        self.player1 = player1
        self.player2 = player2
        self.player1_name = player1_name
        self.player2_name = player2_name
        self.player1_score = player1_score
        self.player2_score = player2_score
        self.players = players
        
        # get player ranks & active players
        active_players = {name: player for name, player in self.players.items() if player.active}
        sorted_active_players = sorted(active_players.items(), key=lambda x: -x[1].score)
        player_ranks = {name: rank + 1 for rank, (name, player) in enumerate(sorted_active_players)}
        
        # Determine winner and loser
        if player1_score > player2_score:
            self.winner = player1
            self.winner_name = player1_name
            self.loser = player2
            self.loser_name = player2_name
            self.winner_score = player1_score
            self.loser_score = player2_score
        else:
            self.winner = player2
            self.winner_name = player2_name
            self.loser = player1
            self.loser_name = player1_name
            self.winner_score = player2_score
            self.loser_score = player1_score
        
        # Set rank information
        self.winner_rank = player_ranks.get(self.winner_name, settings.DEFAULT_RANK)
        self.loser_rank = player_ranks.get(self.loser_name, settings.DEFAULT_RANK)
        
        # Calculate score changes and update scores
        self.winner_score_change = self.winner.update_score(self.loser, True, abs(self.winner_score - self.loser_score))
        self.loser_score_change = self.loser.update_score(self.winner, False, abs(self.winner_score - self.loser_score))
