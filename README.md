<p><span style="text-decoration: underline;"><span style="font-size: 12pt;"><strong>Ping Pong Pi</strong></span></span></p>
<p>This is a score tracking system developed for a group ping pong environment. It is written in python, and runs on a raspberry pi.</p>
<p>To read more, see my project post on<br />https://nelsonarcher.com/projects/ping-pong-pi</p>
<p>&nbsp;</p>
<p><span style="text-decoration: underline;"><span style="font-size: 12pt;"><strong>Changelog</strong></span></span></p>
<p><span style="text-decoration: underline;"><span style="font-size: 12pt;"><strong>v2.2 - 9/27/24</strong></span></span></p>
<ul>
<li>Overhaul of code and data design</li>
<li>400 lines of code were removed</li>
<li>Code was properly broken into files and packages</li>
<li>Added win streak counter (emoji font needs to be installed for this to work on rpi)</li>
<li>Added lifetime best win streak counter</li>
</ul>
<p><strong>v2.1 - 9/12/24</strong></p>
<ul>
<li>Removed ability to farm unranked players. You can now only gain 20 points (at most) from defeating an unranked player.</li>
</ul>
<p><strong>v2.0 - 9/1/24</strong></p>
<ul>
<li>Reworked score calculations</li>
<li>Added "inactive" flag for players who have not played since last score reset</li>
<li>Added a lifetime score tracking and general lifetime player stats</li>
<li>Added stats display on a player double click</li>
</ul>
<p><strong>v1.1 - 6/28/24</strong></p>
<ul>
<li>Added color to both the scoreboard and the player rankings. Updated game history storage settings and display settings. Did a lot of reworking of data structures for player objects.</li>
</ul>
<p><strong>v1.0 - 6/24/24</strong></p>
<ul>
<li>Basic outline for the system, just the game history, player rankings, and scoreboard</li>
</ul>
