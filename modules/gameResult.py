class GameResult:
    def __init__(self, player1_name, player2_name, player1_score, player2_score, player1, player2, player_ranks):
        self.player1_name = player1_name
        self.player2_name = player2_name
        self.player1_score = player1_score
        self.player2_score = player2_score
        self.player1 = player1
        self.player2 = player2
        self.winner_name = player1_name if player1_score > player2_score else player2_name
        self.loser_name = player2_name if player1_score > player2_score else player1_name
        self.winner_score = max(player1_score, player2_score)
        self.loser_score = min(player1_score, player2_score)
        self.winner_rank = player_ranks.get(self.winner_name, "Unranked")
        self.loser_rank = player_ranks.get(self.loser_name, "Unranked")
