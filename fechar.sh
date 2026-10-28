#!/bin/bash
# Desliga o CoffeeLab (faz o último backup no iCloud antes de fechar).
pkill -TERM -f "python3( -u)? server.py" && echo "CoffeeLab fechado ☕" || echo "CoffeeLab já estava fechado"
