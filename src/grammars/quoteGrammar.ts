export const grammar = `
<grammar root="quote">
<rule id="quote">
   <ruleref uri="#by"/>
   <tag>out.quote = new Object(); out.quote.by=rules.by;</tag>
</rule>
<rule id="by">
   <one-of>
      <item>to do is to be<tag>out="socrates";</tag></item>
      <item>to be is to do<tag>out="sartre";</tag></item>
      <item>do be do be do<tag>out="sinatra";</tag></item>
   </one-of>
</rule>
</grammar>
`