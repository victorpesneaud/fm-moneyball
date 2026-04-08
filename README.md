# FM-Moneyball

A data analysis tool for Football Manager that identifies 
undervalued players using advanced statistics — inspired 
by the Moneyball philosophy.

**Live demo:** [link]
please download the file named "Attackers.html" inside of ./fm-moneyball/useful_files to test it out 

## What it does
Analyzes exported FM scouting data to surface statistically 
elite players who are often overlooked by traditional scouting. 
Filter by position, league, age, and value to find hidden gems.

## Stack
Vite, TypeScript

## Features
- Advanced stat weighting by position
- Moneyball efficiency score per player
- Filter and sort by custom metrics

## How to use
1. Filter the players using the specific "view" included in the folder
2. Export your FM scouting report as a "Web Page"
3. Drop it in the app
4. Get your shortlist


list of all the datas required : 
    "name",
    "position",
    "age",
    "nat",
    "height",
    "personality",
    "club",
    "transfer value",
    "mins",
    "pr passes/90",
    "hdrs w/90",
    "hdrs%",
    "tck r",
    "blk/90",
    "int/90",
    "k hdrs/90",
    "poss won/90",
    "poss lost/90",
    "cr c/90",
    "xa/90",
    "ch c/90",
    "k tck/90",
    "tck/90",
    "pres c/90",
    "k pas/90",
    "np-xg/90",  
    "pres a/90",
    "K Ps/90",
    "drb/90",
