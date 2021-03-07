export const grammar = `
<grammar root="initial">
    <rule id="initial">
        <item repeat="0-1">please</item>
        <ruleref uri="#do" />
        <!--NOTE stuff like turn off the air conditioning off (off/on before and after the object)-->
        <tag>out.object = rules.do.object;out.action=rules.do.action</tag>
    </rule>
    <rule id="do">
        <one-of>
            <item>
                <ruleref uri="#actions1" />
                the
                <ruleref uri="#objects1" />
                <ruleref uri="#onoff" />
                <tag>out.action=rules.actions1?rules.actions1:rules.onoff;out.object = rules.objects1;</tag>
            </item>
            <item>
                <ruleref uri="#actions2" />
                the
                <ruleref uri="#objects2" />
                <tag>out.action=rules.actions2;out.object = rules.objects2;</tag>
            </item>
        </one-of>
    </rule>
    <rule id="actions1">
        <one-of>
            <item> turn
                <ruleref uri="#onoff" />
                <tag> out = rules.onoff; </tag>
            </item>
        </one-of>
    </rule>
    <rule id="actions2">
        <one-of>
            <item> open </item>
            <item> close </item>
        </one-of>
    </rule>
    <rule id="objects1">
        <one-of>
            <item> light </item>
            <item> heat </item>
            <item> AC <tag> out = 'air conditioning'; </tag>
            </item>
            <item> air conditioning </item>
        </one-of>
    </rule>
    <rule id="objects2">
        <one-of>
            <item> window </item>
            <item> door </item>
        </one-of>
    </rule>
    <rule id="onoff">
        <item repeat="0-1">
            <one-of>
                <item>on </item>
                <item>off</item>
            </one-of>
        </item>
    </rule>
</grammar>
`