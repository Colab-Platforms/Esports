import React from 'react';

const Section = ({ number, title, children }) => (
  <section className="mb-8">
    <h2 className="text-2xl font-bold text-white mb-4">
      {number ? `${number}. ${title}` : title}
    </h2>
    <div className="text-gray-300 space-y-4 leading-relaxed">{children}</div>
  </section>
);

const RefundPolicyPage = () => {
  return (
    <div className="min-h-screen bg-gaming-dark py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl sm:text-5xl font-gaming font-bold text-white mb-2">
          Refund &amp; Cancellation Policy
        </h1>
        <p className="text-gray-500 mb-10">Effective Date: 2 September 2026</p>

        <Section>
          <p>
            This Refund &amp; Cancellation Policy governs payments, cancellations, refunds, and related
            transactions made through the Colab Esports platform, website, applications, tournaments,
            competitions, and other services (collectively referred to as the "Platform").
          </p>
          <p>
            By making a payment or registering for any paid service, tournament, event, product, or offering
            through Colab Esports, you acknowledge and agree to this Refund &amp; Cancellation Policy.
          </p>
        </Section>

        <Section number={1} title="General Refund Policy">
          <p>
            All payments made through the Colab Esports Platform are subject to the terms and conditions
            outlined in this Refund &amp; Cancellation Policy.
          </p>
          <p>
            Refund eligibility may vary depending on the nature of the tournament, event, service, digital
            product, or other offering for which the payment was made.
          </p>
          <p>
            Unless otherwise specifically stated at the time of purchase or registration, payments made for
            entry fees, registrations, digital services, or other offerings may be non-refundable.
          </p>
        </Section>

        <Section number={2} title="Tournament and Event Registrations">
          <p>Where Colab Esports charges an entry or registration fee for a tournament or event:</p>
          <ul className="list-disc list-inside space-y-2 pl-2">
            <li>Registration fees may be non-refundable once the participant or team has successfully completed the registration process.</li>
            <li>Participants are responsible for ensuring that all registration information is accurate before completing payment.</li>
            <li>Failure to participate in a tournament or event after successful registration will generally not qualify the participant for a refund.</li>
            <li>Disqualification resulting from a violation of tournament rules, Terms of Service, fair-play policies, or other applicable guidelines will not make a participant eligible for a refund.</li>
            <li>Refund requests resulting from changes in personal circumstances, scheduling conflicts, or a decision not to participate may not be accepted.</li>
          </ul>
          <p>
            Colab Esports reserves the right to establish specific refund conditions for individual tournaments
            or events. Where separate terms are published for a specific tournament, those terms may apply in
            addition to this Policy.
          </p>
        </Section>

        <Section number={3} title="Tournament Cancellation or Significant Changes">
          <p>If Colab Esports cancels a paid tournament or event, eligible participants may be offered one or more of the following:</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>A full or partial refund;</li>
            <li>Transfer of registration to a rescheduled event; or</li>
            <li>Credit or another alternative compensation, where legally permitted.</li>
          </ul>
          <p>
            The applicable option will be determined based on the circumstances of the cancellation and
            communicated to affected participants.
          </p>
          <p>
            Colab Esports may modify tournament schedules, formats, match timings, prize structures, rules, or
            other operational details when reasonably necessary. Such modifications will not automatically
            create an entitlement to a refund unless required by applicable law or specifically communicated
            by Colab Esports.
          </p>
        </Section>

        <Section number={4} title="Technical Issues">
          <p>
            Colab Esports strives to provide a reliable Platform. However, technical issues may occur due to
            internet connectivity, gaming servers, third-party platforms, devices, software, payment gateways,
            or other circumstances beyond Colab Esports' reasonable control.
          </p>
          <p>Refunds will generally not be issued for technical problems caused by:</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>The participant's internet connection;</li>
            <li>Personal devices or hardware;</li>
            <li>Unsupported or outdated software;</li>
            <li>Third-party game servers or services outside Colab Esports' reasonable control;</li>
            <li>Failure to follow registration or participation instructions; or</li>
            <li>Incorrect information provided by the participant.</li>
          </ul>
          <p>
            Where a significant technical issue is directly attributable to Colab Esports and materially
            affects a paid service or event, the matter may be reviewed on a case-by-case basis.
          </p>
        </Section>

        <Section number={5} title="Duplicate or Incorrect Payments">
          <p>
            If you believe you have been charged more than once for the same transaction or an incorrect
            payment has been processed, you should contact Colab Esports as soon as reasonably possible.
          </p>
          <p>Eligible duplicate or incorrect payments may be reviewed and refunded after appropriate verification.</p>
          <p>
            Colab Esports may request transaction details or other information reasonably necessary to
            investigate a payment-related issue.
          </p>
        </Section>

        <Section number={6} title="Refund Request Process">
          <p>
            Where a refund is permitted under this Policy, you may contact Colab Esports through the official
            contact channels provided on the Platform.
          </p>
          <p>A refund request should include, where applicable:</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>Full name;</li>
            <li>Registered email address or contact information;</li>
            <li>Tournament, event, product, or service details;</li>
            <li>Transaction or payment reference number;</li>
            <li>Date of payment;</li>
            <li>Reason for the refund request; and</li>
            <li>Relevant supporting information.</li>
          </ul>
          <p>Submitting a refund request does not guarantee approval.</p>
        </Section>

        <Section number={7} title="Refund Processing">
          <p>
            Where a refund is approved, Colab Esports will make reasonable efforts to process the refund
            within an appropriate timeframe.
          </p>
          <p>
            Refunds will generally be issued through the original payment method used for the transaction,
            subject to the policies and technical capabilities of the applicable payment service provider.
          </p>
          <p>
            The time required for the refunded amount to appear in the participant's account may depend on the
            relevant bank, payment gateway, card issuer, or financial institution.
          </p>
          <p>
            Third-party transaction fees or charges may be subject to the policies of the applicable payment
            provider and may not always be refundable.
          </p>
        </Section>

        <Section number={8} title="Chargebacks and Payment Disputes">
          <p>
            If you experience a payment-related issue, we encourage you to contact Colab Esports first so that
            we may investigate and attempt to resolve the matter.
          </p>
          <p>
            Initiating an unauthorized or fraudulent chargeback after successfully receiving or participating
            in a service, tournament, event, or other paid offering may result in account suspension,
            restriction of Platform access, or other appropriate action, subject to applicable law.
          </p>
          <p>Nothing in this section limits your legal rights to raise a legitimate payment dispute with your bank or payment provider.</p>
        </Section>

        <Section number={9} title="Free Tournaments and Services">
          <p>
            Where a tournament, event, registration, or service is offered free of charge, no monetary refund
            will apply because no payment has been collected for participation.
          </p>
          <p>Colab Esports may modify, postpone, suspend, or cancel free tournaments, events, and services when reasonably necessary.</p>
        </Section>

        <Section number={10} title="Promotional Offers and Discounts">
          <p>
            Payments made using promotional discounts, special offers, vouchers, or other promotional benefits
            may be subject to additional terms and conditions.
          </p>
          <p>
            Where a refund is approved for a discounted purchase, the refund amount may be calculated based on
            the actual amount paid by the participant rather than the original or advertised price.
          </p>
          <p>
            Promotional benefits, discounts, vouchers, or other non-cash benefits may not be refundable or
            transferable unless specifically stated otherwise.
          </p>
        </Section>

        <Section number={11} title="Fraudulent or Abusive Claims">
          <p>
            Colab Esports reserves the right to investigate and take appropriate action regarding refund
            requests that appear to involve fraud, abuse, misrepresentation, manipulation, or violations of
            the Terms of Service, tournament rules, or other applicable policies.
          </p>
          <p>
            Where permitted by applicable law, fraudulent activities may result in account suspension,
            disqualification from tournaments, restriction of Platform access, or other appropriate action.
          </p>
        </Section>

        <Section number={12} title="Changes to This Policy">
          <p>
            Colab Esports may update or modify this Refund &amp; Cancellation Policy from time to time to
            reflect changes in its services, operations, legal requirements, or business practices.
          </p>
          <p>Any updated version will become effective when published on the Colab Esports Platform unless otherwise stated.</p>
          <p>Users are encouraged to review this Policy periodically.</p>
        </Section>

        <Section number={13} title="Contact Us">
          <p>
            If you have questions regarding this Refund &amp; Cancellation Policy or wish to submit a
            refund-related request, please contact Colab Esports through the official contact information
            available on the Platform.
          </p>
          <p>
            Website:{' '}
            <a href="https://www.colabesports.in/" className="text-gaming-neon hover:underline">
              https://www.colabesports.in/
            </a>
          </p>
        </Section>
      </div>
    </div>
  );
};

export default RefundPolicyPage;
