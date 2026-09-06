(() => {
  const root=document.querySelector('[data-games]');if(!root)return;
  const games=[
    {title:'Aircraft Quickfire',qs:[
      ['Which aircraft is a four-engine double-deck airliner?',['Airbus A380','Boeing 787-9','Airbus A321neo'],0],
      ['Which family includes the -8, -9 and -10 Dreamliner?',['Boeing 777','Boeing 787','Airbus A350'],1],
      ['Which is the largest 737 MAX variant?',['MAX 7','MAX 8','MAX 10'],2]
    ]},
    {title:'Airport Codes',qs:[
      ['EDI is…',['Edinburgh','Dublin','East Midlands'],0],['LHR is…',['London Heathrow','London City','Manchester'],0],['DXB is…',['Doha','Dubai','Delhi'],1]
    ]},
    {title:'Widebody Check',qs:[
      ['Which is a widebody?',['A350-1000','A220-300','737-800'],0],['Which has two full passenger decks?',['747-8','A380','777-300ER'],1],['Which is Airbus?',['787-9','A330-900','777-9'],1]
    ]}
  ];
  root.innerHTML=games.map((g,i)=>`<article class="game-card" data-game="${i}"><span class="eyebrow">JetVault Game</span><h3>${g.title}</h3><div data-game-body></div></article>`).join('');
  games.forEach((g,i)=>{let q=0,score=0;const box=root.querySelector(`[data-game="${i}"] [data-game-body]`);
    function draw(){if(q>=g.qs.length){box.innerHTML=`<p>Score: <b>${score}/${g.qs.length}</b></p><button class="solid-button" data-restart>Play again</button>`;box.querySelector('[data-restart]').onclick=()=>{q=0;score=0;draw()};return}
      const [text,opts,ans]=g.qs[q];box.innerHTML=`<p>${text}</p><div class="game-options">${opts.map((o,n)=>`<button data-answer="${n}">${o}</button>`).join('')}</div><small>Question ${q+1}/${g.qs.length}</small>`;
      box.querySelectorAll('[data-answer]').forEach(b=>b.onclick=()=>{if(Number(b.dataset.answer)===ans)score++;q++;draw()});
    }draw();
  });
})();
