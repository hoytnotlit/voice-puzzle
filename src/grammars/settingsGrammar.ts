export const grammar = `
<grammar root="puzzleMove">
<rule id="puzzleMove">
   <item repeat="0-1">change</item>
   <ruleref uri="#setting"/>
   <tag>out.setting = rules.setting</tag>
</rule>
<rule id="setting">
   <one-of>
      <item>image</item> 
      <item>mode</item> 
   </one-of>
</rule>
</grammar>
`