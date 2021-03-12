export const grammar = `
<grammar root="puzzleMove">
<rule id="puzzleMove">
   <item repeat="0-1">
   <ruleref uri="#piece"/>
   </item>
   <item repeat="0-1">
   <ruleref uri="#degree"/>
   </item>
   <item repeat="0-1">
   <ruleref uri="#direction"/>
   </item>
   <tag>out.puzzleMove = new Object(); out.puzzleMove.piece=rules.piece;out.puzzleMove.degree=rules.degree;</tag>
</rule>
<rule id="piece">
   <one-of>
      <item>top left<tag>out="top-left";</tag></item> 
      <item>top center<tag>out="top-center";</tag></item> 
      <item>top right<tag>out="top-right";</tag></item> 
      <item>middle left<tag>out="middle-left";</tag></item> 
      <item>middle center<tag>out="middle-center";</tag></item> 
      <item>middle right<tag>out="middle-right";</tag></item> 
      <item>bottom left<tag>out="bottom-left";</tag></item> 
      <item>bottom center<tag>out="bottom-center";</tag></item> 
      <item>bottom right<tag>out="bottom-right";</tag></item> 
   </one-of>
</rule>
<rule id="degree">
   <one-of>
      <item>90</item>
      <item>once <tag>out=90;</tag></item>
      <item>180</item>
      <item>twice <tag>out=180;</tag></item>
      <item>270</item>
      <item>three times <tag>out=270;</tag></item>
      <item>360</item> 
   </one-of>
</rule>
<rule id="direction">
   <one-of>
      <item>left</item>
      <item>right</item>
   </one-of>
</rule>
</grammar>
`