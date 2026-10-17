from pathlib import Path
import re

root = Path(__file__).resolve().parent
source = (root / 'identity-machine-paper.md').read_text(encoding='utf-8')

def escape(s):
    out = s.replace('\\', r'\textbackslash{}')
    for old, new in [('&', r'\&'), ('%', r'\%'), ('$', r'\$'), ('#', r'\#'), ('_', r'\_')]:
        out = out.replace(old, new)
    out = out.replace('–', '--').replace('—', '---').replace('’', "'")
    out = out.replace('Höök', r'H\"o\"ok').replace('Ståhl', r'St\aa hl')
    out = re.sub(r'\*(.*?)\*', r'\\emph{\1}', out)
    return out

parts = source.split('## References\n', 1)
body = parts[0]
abstract = body.split('## Abstract\n', 1)[1].split('**Keywords:**', 1)[0].strip()
main = body.split('## 1 Introduction and Artistic Motivation\n', 1)[1]
main = '## 1 Introduction and Artistic Motivation\n' + main

tex = r'''\documentclass[manuscript,screen,nonacm]{acmart}
\setcopyright{none}
\settopmatter{printacmref=false}
\renewcommand\footnotetextcopyrightpermission[1]{}
\title{Identity Machine and the Encounter with a Possible Self}
\author{Duy\^en (Anna) L\^e}
\affiliation{\institution{School of Art, Texas Tech University}\city{Lubbock}\state{Texas}\country{USA}}
\email{duyele@ttu.edu}
\begin{document}
\begin{abstract}
'''
tex += escape(abstract) + '\n\\end{abstract}\n'
tex += r'\keywords{EEG, generative video, self-representation, participatory art, embodied interaction, identity}' + '\n\\maketitle\n'

for p in main.strip().split('\n\n'):
    if p.startswith('## '):
        title = re.sub(r'^## \d+\s+', '', p)
        tex += '\\section{' + escape(title) + '}\n'
    else:
        text = escape(p)
        text = re.sub(r'\[(\d+)\]', lambda m: r'\cite{r' + m.group(1) + '}', text)
        tex += text + '\n\n'
        if p.startswith('The current server configuration'):
            tex += r'''\begin{figure}[ht]
\centering
\small
\begin{tabular}{ccl}
Photograph & $\longrightarrow$ & recognisable appearance\\
Optional words & $\longrightarrow$ & role, setting, action\\
EEG features & $\longrightarrow$ & authored visual descriptions\\[3pt]
\multicolumn{3}{c}{$\Downarrow$}\rule{0pt}{12pt}\\
\multicolumn{3}{c}{Generated portrait $\longrightarrow$ generated film $\longrightarrow$ self-interpretation}
\end{tabular}
\caption{Input paths in Identity Machine. EEG influences generation through authored text; it does not decode an imagined scene. When words are absent, the visual vocabulary also supplies the setting.}
\Description{Three inputs contribute to a generated portrait and film. The photograph provides appearance, words suggest a role and action, and EEG features are mapped to visual descriptions. The participant interprets the output.}
\end{figure}

'''

tex += '\\begin{thebibliography}{8}\n'
for p in parts[1].strip().split('\n\n'):
    m = re.match(r'\[(\d+)\] (.*)', p, re.S)
    n, entry = m.groups()
    url = re.search(r'https://\S+', entry).group()
    entry = entry.replace(url, '').strip()
    tex += '\\bibitem{r' + n + '} ' + escape(entry) + ' \\url{' + url + '}\n\n'
tex += '\\end{thebibliography}\n\\end{document}\n'
(root / 'identity-machine-paper.tex').write_text(tex, encoding='utf-8')
print('Manuscript words excluding references:', len(body.split()))
print('Created self-contained ACM LaTeX manuscript.')
