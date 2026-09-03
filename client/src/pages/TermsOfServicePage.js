import React from 'react';

const Section = ({ number, title, children }) => (
  <section className="mb-8">
    <h2 className="text-2xl font-bold text-white mb-4">
      {number ? `${number}. ${title}` : title}
    </h2>
    <div className="text-gray-300 space-y-4 leading-relaxed">{children}</div>
  </section>
);

const TermsOfServicePage = () => {
  return (
    <div className="min-h-screen bg-gaming-dark py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl sm:text-5xl font-gaming font-bold text-white mb-2">
          Terms of Service
        </h1>
        <p className="text-gray-500 mb-10">Last Updated: September 2, 2026</p>

        <Section>
          <p>Welcome to Colab Esports.</p>
          <p>
            These Terms of Service ("Terms") govern your access to and use of the Colab Esports website,
            platform, tournaments, events, communities, services, content, and related features
            (collectively referred to as the "Services").
          </p>
          <p>
            By accessing, browsing, registering on, or using any of our Services, you acknowledge that you
            have read, understood, and agreed to be bound by these Terms. If you do not agree with these
            Terms, you must not access or use our Services.
          </p>
        </Section>

        <Section number={1} title="ABOUT COLAB ESPORTS">
          <p>
            Colab Esports is an esports and gaming platform operated under the Colab brand. The platform may
            provide gaming communities, esports tournaments, competitions, events, gaming-related content,
            rewards, digital features, and other related services.
          </p>
          <p>
            Colab Esports reserves the right to introduce, modify, suspend, or discontinue any part of its
            Services at any time, subject to applicable laws.
          </p>
        </Section>

        <Section number={2} title="ACCEPTANCE OF TERMS">
          <p>By accessing or using Colab Esports, you confirm that:</p>
          <ul className="list-disc list-inside space-y-2 pl-2">
            <li>You agree to comply with these Terms and all applicable laws and regulations.</li>
            <li>The information provided by you during registration or participation is accurate and complete.</li>
            <li>You will use the platform and its Services only for lawful and authorised purposes.</li>
            <li>You will comply with all applicable tournament rules, competition guidelines, and community policies issued by Colab Esports.</li>
          </ul>
          <p>
            If you are using our Services on behalf of a team, organisation, or other entity, you represent
            that you have the authority to accept these Terms on behalf of that entity.
          </p>
        </Section>

        <Section number={3} title="ELIGIBILITY">
          <p>
            Certain Services, tournaments, competitions, events, or rewards offered through Colab Esports may
            have specific eligibility requirements.
          </p>
          <p>Participants may be required to meet requirements relating to:</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>Age</li>
            <li>Geographic location</li>
            <li>Game account eligibility</li>
            <li>Team composition</li>
            <li>Identity verification</li>
            <li>Tournament registration</li>
            <li>Compliance with game publisher rules</li>
            <li>Other requirements specified for a particular event</li>
          </ul>
          <p>Colab Esports reserves the right to verify participant eligibility at any stage of a tournament or event.</p>
          <p>
            Providing false information or attempting to bypass eligibility requirements may result in
            immediate disqualification or suspension from the platform.
          </p>
        </Section>

        <Section number={4} title="USER ACCOUNTS AND REGISTRATION">
          <p>Certain features may require users to create an account or submit registration information.</p>
          <p>You are responsible for:</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>Providing accurate and up-to-date information.</li>
            <li>Maintaining the confidentiality of your login credentials.</li>
            <li>Ensuring that unauthorised persons do not access your account.</li>
            <li>Informing us of any suspected unauthorised access or security breach.</li>
          </ul>
          <p>You may not:</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>Create fraudulent accounts.</li>
            <li>Impersonate another individual or organisation.</li>
            <li>Sell, transfer, rent, or share your account without authorisation.</li>
            <li>Use another person's account without permission.</li>
            <li>Manipulate account information to gain an unfair advantage.</li>
          </ul>
          <p>Colab Esports reserves the right to suspend, restrict, or terminate accounts that violate these Terms.</p>
        </Section>

        <Section number={5} title="TOURNAMENTS AND COMPETITIONS">
          <p>Colab Esports may organise or facilitate tournaments and competitive gaming events across various games.</p>
          <p>Participation in a tournament is subject to:</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>The specific rules and regulations of that tournament.</li>
            <li>Eligibility requirements.</li>
            <li>Registration requirements.</li>
            <li>Game publisher or developer policies.</li>
            <li>Decisions made by tournament administrators and officials.</li>
          </ul>
          <p>
            Tournament-specific rules may supplement these Terms. In the event of a conflict between these
            Terms and specific tournament rules, the tournament-specific rules may apply to that particular
            competition.
          </p>
          <p>Participants are responsible for reviewing and understanding the rules before participating.</p>
        </Section>

        <Section number={6} title="PLAYER AND TEAM CONDUCT">
          <p>All players, teams, managers, coaches, and participants are expected to maintain professional and respectful conduct.</p>
          <p>The following activities are strictly prohibited:</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>Cheating or exploiting game mechanics.</li>
            <li>Using hacks, scripts, bots, unauthorised software, or modifications.</li>
            <li>Account sharing or account manipulation.</li>
            <li>Match-fixing or attempting to manipulate match results.</li>
            <li>Collusion with other players or teams.</li>
            <li>Stream sniping or intentionally gaining unfair information.</li>
            <li>Exploiting technical errors or tournament vulnerabilities.</li>
            <li>Providing false player or team information.</li>
            <li>Harassing, threatening, abusing, or discriminating against other participants.</li>
            <li>Using offensive, hateful, or inappropriate language.</li>
            <li>Attempting to disrupt a tournament or event.</li>
            <li>Impersonating another player or organisation.</li>
            <li>Attempting to gain an unfair competitive advantage.</li>
          </ul>
          <p>Colab Esports reserves the right to investigate suspected violations and take appropriate action.</p>
        </Section>

        <Section number={7} title="CHEATING AND UNFAIR PLAY">
          <p>Colab Esports maintains a zero-tolerance approach towards cheating and unfair competitive practices.</p>
          <p>Participants found engaging in cheating or attempting to manipulate a competition may face penalties, including:</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>Match penalties.</li>
            <li>Removal from a match.</li>
            <li>Team disqualification.</li>
            <li>Tournament disqualification.</li>
            <li>Forfeiture of rewards or prizes.</li>
            <li>Temporary suspension.</li>
            <li>Permanent suspension from future Colab Esports events.</li>
          </ul>
          <p>
            Decisions relating to competitive integrity will be made based on available evidence and the
            findings of Colab Esports tournament administrators.
          </p>
        </Section>

        <Section number={8} title="TOURNAMENT ADMINISTRATION">
          <p>Colab Esports tournament administrators and officials are responsible for managing competitions and enforcing tournament rules.</p>
          <p>Administrators may:</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>Investigate reported violations.</li>
            <li>Request screenshots, recordings, or other relevant evidence.</li>
            <li>Review gameplay and match information.</li>
            <li>Issue warnings or penalties.</li>
            <li>Modify match schedules when reasonably necessary.</li>
            <li>Pause, restart, or cancel matches in exceptional circumstances.</li>
            <li>Disqualify participants who violate applicable rules.</li>
          </ul>
          <p>
            The decisions of Colab Esports tournament administrators regarding tournament operations and rule
            enforcement shall be considered final, subject to applicable law.
          </p>
        </Section>

        <Section number={9} title="PRIZES AND REWARDS">
          <p>Certain tournaments or events may offer prizes, rewards, recognition, or other benefits.</p>
          <p>Prize eligibility may depend on:</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>Successful completion of tournament requirements.</li>
            <li>Compliance with tournament rules.</li>
            <li>Verification of participant information.</li>
            <li>Compliance with applicable laws.</li>
            <li>Completion of any required verification procedures.</li>
          </ul>
          <p>
            Colab Esports reserves the right to withhold or revoke prizes where there is reasonable evidence
            of fraud, cheating, rule violations, or ineligibility.
          </p>
          <p>Prize distribution timelines may vary depending on verification procedures and other operational requirements.</p>
          <p>Participants are responsible for providing accurate information necessary for prize distribution.</p>
          <p>
            Any applicable taxes, government charges, or financial obligations relating to prizes may be the
            responsibility of the recipient, subject to applicable law.
          </p>
        </Section>

        <Section number={10} title="TECHNICAL ISSUES">
          <p>Colab Esports cannot guarantee uninterrupted access to its website, games, tournaments, or digital Services.</p>
          <p>Technical issues may arise due to:</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>Internet connectivity problems.</li>
            <li>Server issues.</li>
            <li>Game publisher servers.</li>
            <li>Third-party platforms.</li>
            <li>Device failures.</li>
            <li>Software errors.</li>
            <li>Power interruptions.</li>
            <li>Other circumstances beyond our reasonable control.</li>
          </ul>
          <p>
            Participants are generally responsible for ensuring that they have a stable internet connection,
            compatible device, and appropriate gaming environment.
          </p>
          <p>
            Colab Esports reserves the right to make reasonable decisions regarding technical issues during
            tournaments based on the circumstances of each situation.
          </p>
        </Section>

        <Section number={11} title="INTELLECTUAL PROPERTY RIGHTS">
          <p>
            All content, materials, branding, designs, graphics, logos, trademarks, website elements,
            tournament concepts, text, videos, promotional materials, and other intellectual property
            associated with Colab Esports are protected by applicable intellectual property laws.
          </p>
          <p>
            Unless otherwise stated, all rights, title, and interest in such materials belong to Colab
            Esports, Colab Platforms Limited, or their respective licensors.
          </p>
          <p>You may not, without prior written permission:</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>Copy or reproduce our content.</li>
            <li>Modify or distribute our materials.</li>
            <li>Use our branding for commercial purposes.</li>
            <li>Create unauthorised derivative works.</li>
            <li>Use Colab Esports logos or trademarks without authorisation.</li>
            <li>Misrepresent an affiliation with Colab Esports.</li>
            <li>Sell or commercially exploit Colab Esports intellectual property.</li>
          </ul>
        </Section>

        <Section number={12} title="COLAB ESPORTS MASCOT AND BRAND ASSETS">
          <p>
            The official mascot, character designs, visual representations, artwork, branding elements,
            logos, names, and associated creative assets used by Colab Esports are proprietary intellectual
            property.
          </p>
          <p>
            All rights relating to the Colab Esports mascot and associated brand assets are reserved by Colab
            Esports and/or its authorised rights holders.
          </p>
          <p>
            Users, participants, organisations, and third parties may not reproduce, copy, modify, distribute,
            commercially exploit, register, or otherwise use the Colab Esports mascot or associated brand
            assets without prior written permission.
          </p>
          <p>Unauthorised use of these assets may result in legal action or other remedies available under applicable law.</p>
        </Section>

        <Section number={13} title="THIRD-PARTY GAMES AND PLATFORMS">
          <p>Colab Esports may organise tournaments involving games and platforms owned or operated by third parties.</p>
          <p>
            All trademarks, game titles, characters, logos, and intellectual property belonging to respective
            game publishers and developers remain the property of their respective owners.
          </p>
          <p>Colab Esports is an independent esports platform unless explicitly stated otherwise.</p>
          <p>
            Participation in tournaments may also require users to comply with the applicable terms,
            policies, and rules of the relevant game publisher or platform.
          </p>
        </Section>

        <Section number={14} title="USER-GENERATED CONTENT">
          <p>Users may submit content to Colab Esports, including but not limited to:</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>Team names.</li>
            <li>Player information.</li>
            <li>Images.</li>
            <li>Videos.</li>
            <li>Gameplay recordings.</li>
            <li>Social media content.</li>
            <li>Comments.</li>
            <li>Feedback.</li>
          </ul>
          <p>By submitting content, you confirm that you have the necessary rights to submit such content.</p>
          <p>
            You grant Colab Esports a non-exclusive, royalty-free, worldwide licence to use, reproduce,
            display, distribute, and promote such content in connection with the operation and promotion of
            Colab Esports and its Services.
          </p>
          <p>This may include promotional content relating to tournaments, events, social media, broadcasts, and marketing materials.</p>
        </Section>

        <Section number={15} title="COMMUNITY GUIDELINES">
          <p>Users are expected to contribute to a safe and respectful gaming environment.</p>
          <p>You must not use Colab Esports platforms or communities to:</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>Harass or threaten others.</li>
            <li>Publish hateful or discriminatory content.</li>
            <li>Share illegal or harmful content.</li>
            <li>Promote scams or fraudulent activities.</li>
            <li>Distribute malicious software.</li>
            <li>Spam other users.</li>
            <li>Share another person's private information without permission.</li>
            <li>Engage in activities that disrupt the community.</li>
          </ul>
          <p>Colab Esports reserves the right to remove content or restrict users who violate these standards.</p>
        </Section>

        <Section number={16} title="THIRD-PARTY LINKS AND SERVICES">
          <p>Our Services may contain links to third-party websites, applications, social media platforms, or services.</p>
          <p>
            Colab Esports does not control and is not responsible for the content, privacy practices,
            security, or operations of third-party services.
          </p>
          <p>Your use of third-party services is subject to their respective terms and policies.</p>
        </Section>

        <Section number={17} title="PRIVACY">
          <p>Your use of Colab Esports is also governed by our Privacy Policy.</p>
          <p>
            By using our Services, you acknowledge that information may be collected, used, stored, and
            processed in accordance with our Privacy Policy and applicable laws.
          </p>
          <p>We encourage users to review the Privacy Policy to understand how personal information is handled.</p>
        </Section>

        <Section number={18} title="SUSPENSION AND TERMINATION">
          <p>Colab Esports reserves the right to suspend, restrict, or terminate access to its Services if a user:</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>Violates these Terms.</li>
            <li>Violates tournament rules.</li>
            <li>Engages in fraudulent activity.</li>
            <li>Engages in cheating or unfair practices.</li>
            <li>Harms or attempts to harm the Colab Esports community.</li>
            <li>Provides false information.</li>
            <li>Engages in unlawful activities.</li>
          </ul>
          <p>
            Termination or suspension may occur without prior notice where reasonably necessary to protect the
            platform, its users, or the integrity of a competition.
          </p>
        </Section>

        <Section number={19} title="DISCLAIMERS">
          <p>The Services provided by Colab Esports are offered on an "as available" basis.</p>
          <p>While we strive to provide accurate and reliable Services, we do not guarantee that:</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>The website will always be available.</li>
            <li>All Services will operate without interruption.</li>
            <li>Errors will never occur.</li>
            <li>Tournament schedules will never change.</li>
            <li>Third-party services will remain available.</li>
          </ul>
          <p>
            To the maximum extent permitted by applicable law, Colab Esports disclaims warranties that are not
            expressly stated in these Terms.
          </p>
        </Section>

        <Section number={20} title="LIMITATION OF LIABILITY">
          <p>
            To the maximum extent permitted by applicable law, Colab Esports, its affiliates, directors,
            employees, partners, and representatives shall not be liable for indirect, incidental, special,
            consequential, or punitive damages arising from your use of, or inability to use, the Services.
          </p>
          <p>Nothing in these Terms shall exclude or limit liability where such exclusion or limitation is prohibited by applicable law.</p>
        </Section>

        <Section number={21} title="INDEMNIFICATION">
          <p>
            You agree to indemnify and hold harmless Colab Esports, its affiliates, representatives,
            employees, and partners from claims, damages, liabilities, costs, or expenses arising from:
          </p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>Your violation of these Terms.</li>
            <li>Your violation of applicable laws.</li>
            <li>Your violation of tournament rules.</li>
            <li>Your infringement of another person's rights.</li>
            <li>Your misuse of the Services.</li>
          </ul>
        </Section>

        <Section number={22} title="MODIFICATION OF TERMS">
          <p>Colab Esports reserves the right to modify or update these Terms from time to time.</p>
          <p>
            Updated Terms may be published on the Colab Esports website. Your continued use of the Services
            after the updated Terms become effective constitutes your acceptance of the revised Terms.
          </p>
          <p>We encourage users to review these Terms periodically.</p>
        </Section>

        <Section number={23} title="GOVERNING LAW AND JURISDICTION">
          <p>These Terms shall be governed and interpreted in accordance with the applicable laws of India.</p>
          <p>
            Any disputes arising in connection with these Terms or the use of Colab Esports Services shall be
            subject to the jurisdiction of the competent courts, subject to applicable law and any mandatory
            dispute resolution requirements.
          </p>
        </Section>

        <Section number={24} title="CONTACT US">
          <p>
            If you have questions, concerns, or complaints regarding these Terms of Service, you may contact
            Colab Esports through the official contact channels provided on our website.
          </p>
        </Section>

        <div className="border-t border-gray-700 pt-8 mt-12">
          <h2 className="text-2xl font-bold text-white mb-4">ACKNOWLEDGEMENT</h2>
          <p className="text-gray-300 leading-relaxed">
            By accessing or using Colab Esports and its Services, you acknowledge that you have read,
            understood, and agreed to these Terms of Service.
          </p>
        </div>
      </div>
    </div>
  );
};

export default TermsOfServicePage;
