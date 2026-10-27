import { Link, useParams } from "react-router-dom";
import { Heading, Empty } from "../components/Common";
const journals = [
  {
    title: "How a package specification is written.",
    tag: "SPECIFICATIONS / 01",
    body: "A label such as 332 5mg*10vials has three parts: the product code, the milligrams in each vial, and the number of vials in the package. So that label is ten vials of 5mg each, priced and sold as one package. Some products are published by code alone — RT10, BB20 — with no quantity attached; we keep those exactly as the source catalogue prints them rather than guessing what is inside. The price on a product page always belongs to the package you have selected, never to a single vial.",
  },
  {
    title: "GLP series, single peptides and blends.",
    tag: "THE CATALOGUE / 02",
    body: "The catalogue is split three ways. The GLP series covers Semaglutide, Tirzepatide, Retatrutide, Mazdutide and Cagrilintide — the products with the widest spread of package sizes, with Tirzepatide alone running from 5mg to 60mg per vial. Single peptides is the largest group: BPC-157, TB-500, Ipamorelin, Melanotan I and II, PT-141, Semax, Selank, Epithalon, GHK-Cu and more, usually in two or three sizes each. Peptide blends arrive pre-combined, such as BPC 10mg + TB500 10mg. Across all three, prices run from $21.00 to $450.00 per package.",
  },
  {
    title: "Ordering, payment and shipping.",
    tag: "HOW TO ORDER / 03",
    body: "Add the packages you want to your bag, sign in, and place the order. The order is created as awaiting payment and nothing is charged on this site. Availability is confirmed with us on WhatsApp before you pay. Open your order history and select Pay via WhatsApp — that opens a message to us with your order number, items and total already written out, which you send when you are ready. We confirm payment, then dispatch. Shipping is $15 per order, or complimentary above $500.",
  },
];
export function JournalCards() {
  return (
    <div className="journal-grid">
      {journals.map((j, i) => (
        <article key={i}>
          <Link className="journal-image" to={"/journal/" + i}>
            <img
              src={"/images/journal-" + i + ".svg"}
              alt={j.title}
              loading="lazy"
            />
          </Link>
          <div>
            <small>{j.tag}</small>
            <Link to={"/journal/" + i}>
              <h3>{j.title}</h3>
            </Link>
            <Link className="text-link" to={"/journal/" + i}>
              Read the note ↗
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}
export function Journal() {
  const { id } = useParams();
  if (id !== undefined) {
    const j = journals[Number(id)];
    return j ? (
      <article className="article">
        <span className="eyebrow">{j.tag}</span>
        <h1>{j.title}</h1>
        <img src={"/images/journal-" + id + ".svg"} alt={j.title} />
        <p>{j.body}</p>
        <Link to="/journal">← All research notes</Link>
      </article>
    ) : (
      <Empty title="Note unavailable." />
    );
  }
  return (
    <>
      <Heading
        title="Research notes."
        subtitle="Reading specifications, choosing a package, and how ordering works."
      />
      <section className="section">
        <JournalCards />
      </section>
    </>
  );
}
export function Quality() {
  return (
    <>
      <Heading
        title="How we ensure quality."
        subtitle="Tideora supplies high-purity peptides for laboratory and in-vitro research. Every lot is verified by an independent laboratory — not by us."
      />
      <article className="article quality-article">
        <span className="eyebrow">OUR STANDARD</span>
        <h2>We don&apos;t grade our own homework.</h2>
        <p>
          Every lot goes to an independent third-party analytical laboratory
          before it is listed. We never self-report a number. Our release
          floor is 99%+ identity purity — anything under it doesn&apos;t ship.
          Lot-specific Certificates of Analysis are published as each lot
          clears testing, and when a report is still pending, we say so
          instead of showing you something else.
        </p>
        <p>
          Every order carries a research-use-only acknowledgment, and a
          documented receipt lands in your inbox.
        </p>

        <h3>Third-party tested. Lot by lot. Order by order.</h3>
        <h3>What every lot is measured against</h3>
        <p>
          An independent laboratory runs every assay — never us. These are
          the tests, and the numbers they return are published in each
          lot&apos;s Certificate of Analysis.
        </p>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ padding: "10px 12px", textAlign: "left", borderBottom: "2px solid #0f2e26" }}>Assay</th>
              <th style={{ padding: "10px 12px", textAlign: "left", borderBottom: "2px solid #0f2e26" }}>Method</th>
              <th style={{ padding: "10px 12px", textAlign: "left", borderBottom: "2px solid #0f2e26" }}>Release threshold</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["Identity", "HPLC against a reference standard", "99%+ identity purity"],
              ["Mass", "Mass spectrometry", "Molecular weight confirmed"],
              ["Purity", "HPLC peak area", "99%+ by peak area"],
              ["Sterility", "PCR", "No growth"],
              ["Endotoxin", "LAL", "Measured value published per lot"],
              ["Heavy metals", "ICP-MS", "Within USP <233> limits"],
            ].map(([a, m, t]) => (
              <tr key={a}>
                <td style={{ padding: "10px 12px", borderBottom: "1px solid #ddd" }}>{a}</td>
                <td style={{ padding: "10px 12px", borderBottom: "1px solid #ddd" }}>{m}</td>
                <td style={{ padding: "10px 12px", borderBottom: "1px solid #ddd" }}>{t}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p><small>These are release thresholds, not lot results. Lot results are published in the COA.</small></p>

        <h3>Not every supplier shows their work.</h3>
        <p>
          Anyone can claim a number. The difference is whether there is a
          report behind it — written by someone with no stake in the answer.
        </p>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ padding: "10px 12px", textAlign: "left", borderBottom: "2px solid #0f2e26" }}>What you can verify</th>
              <th style={{ padding: "10px 12px", textAlign: "left", borderBottom: "2px solid #0f2e26" }}>Tideora</th>
              <th style={{ padding: "10px 12px", textAlign: "left", borderBottom: "2px solid #0f2e26" }}>Typical overseas supplier</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["Independent third-party testing on every lot", "✓", "Often unverified"],
              ["99%+ identity purity, HPLC verified", "✓", "Rarely stated"],
              ["Lot-specific COA published as testing completes", "✓", "Rarely provided"],
              ["Ships from China", "✓", "Offshore"],
              ["Free shipping on orders $500+", "✓", "Usually paid"],
            ].map(([k, a, b]) => (
              <tr key={k}>
                <td style={{ padding: "10px 12px", borderBottom: "1px solid #ddd" }}>{k}</td>
                <td style={{ padding: "10px 12px", borderBottom: "1px solid #ddd" }}>{a}</td>
                <td style={{ padding: "10px 12px", borderBottom: "1px solid #ddd" }}>{b}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3>What that means in practice</h3>
        <h4>What a COA contains</h4>
        <p>
          The assays above with their measured results, the lot number
          identifying the lot the report covers, the test date, and the
          independent laboratory that issued it. If a document is missing
          any of those, it is not a lot report.
        </p>
        <h4>When reports publish</h4>
        <p>
          Per lot, as each one clears independent testing — not on a
          schedule and not in advance. We don&apos;t put up placeholder
          documents in the meantime.
        </p>
        <h4>If a lot fails re-verification</h4>
        <p>
          If a delivered lot is independently re-tested and the result
          disagrees with its certificate, send us the report and your order
          number — we will make it right.
        </p>

        <h3>Look up a lot before you buy.</h3>
        <p>
          Lot-specific Certificates of Analysis publish as each lot clears
          independent testing. When a report is still pending, the listing
          says so. No guessing.
        </p>
        <Link className="btn" to="/coa">
          COA Portal ↗
        </Link>{" "}
        <Link className="btn" to="/shop">
          Browse the catalogue ↗
        </Link>
      </article>
    </>
  );
}
export function Faq() {
  const sections: [string, [string, string][]][] = [
    ["Compliance & use", [
      ["What are these products for?", "Laboratory and in-vitro research only — never for human or veterinary use, and never for any therapeutic, diagnostic, or cosmetic purpose. Placing an order means you accept the Research-Use-Only acknowledgment shown at checkout."],
      ["Do I need to sign anything?", "Just one acknowledgment. At checkout you confirm the Research-Use-Only terms before the order is captured, and a copy of what you agreed to comes with your order confirmation."],
      ["Is there an age requirement?", "You must be 21 or older to purchase. It is part of our compliance policy and a condition of every sale."],
    ]],
    ["Quality & testing", [
      ["Is every lot tested?", "Yes — by a lab that isn't us. Every lot is independently analyzed for identity, mass, purity, and endotoxin, and lot-specific Certificates of Analysis are published as each lot clears testing."],
      ["Who does the testing?", "Independent analytical laboratories handle every release — not us. The panel covers identity (HPLC), molecular mass (MS), purity by HPLC peak area, and bacterial endotoxin (LAL)."],
      ["What is the release floor?", "99%+ identity purity by HPLC — a lot that doesn't clear it doesn't get listed. Each lot's exact figure is printed on its Certificate of Analysis."],
      ["What if re-verification disagrees?", "If a delivered lot is independently re-verified within 30 days and tests below its stated identity-purity floor, or shows endotoxin above the level on its Certificate of Analysis, we provide a refund and replacement."],
    ]],
    ["Shipping & fulfillment", [
      ["How fast do orders ship?", "Once payment clears, orders ship within 24 hours, Monday to Friday. Weekend orders go out on Monday. Tracking details are sent via WhatsApp or email the moment your order ships."],
      ["What does shipping cost?", "One flat rate for every order, and orders of $500 or more ship free. We ship worldwide via FedEx Express — fully tracked."],
      ["Do you ship to PO Boxes?", "We ship to street addresses worldwide. If you can only receive to a PO Box, contact us before ordering."],
      ["How are orders packaged?", "Orders ship in plain outer packaging with no contents listed on the outside — standard for laboratory shipments. Delivery doesn't require a signature."],
      ["How should products be stored?", "Lyophilized compounds are stored sealed at 2–8°C, desiccated and protected from light. Bacteriostatic water is stored at room temperature. Check the product page for the storage detail of each compound."],
    ]],
    ["Orders & payment", [
      ["How do I order?", "Add compounds to your cart from the shop or a product page. At checkout, confirm the Research Use Only acknowledgment, enter your shipping address, and pay. Once payment clears, orders ship within 24 hours, Monday to Friday."],
      ["What payment methods do you accept?", "Major credit and debit cards at checkout through a secure, PCI-compliant processor — your card details never touch our servers. For other payment options, contact us before ordering."],
      ["Can I change or cancel an order?", "If it hasn't shipped, contact us within an hour of ordering and we'll change or cancel it. Once a tracking number is generated, the package is already moving and can't be recalled."],
      ["Can I order larger quantities?", "For larger quantities, contact us with the compounds and quantities you need before ordering — we'll confirm stock and timing."],
      ["What about returns?", "Research materials can't be returned once shipped. If a protected shipment arrives damaged — or doesn't arrive — contact us with your order number and we'll replace or refund it."],
    ]],
  ];
  return (
    <>
      <Heading
        title="Questions, answered."
        subtitle="The questions researchers ask before a first order, answered plainly from our published policies."
      />
      <article className="article quality-article">
        {sections.map(([title, items], si) => (
          <div key={title}>
            <h3>{si + 1 < 10 ? `0${si + 1}` : si + 1} · {title}</h3>
            {items.map(([q, a]) => (
              <div key={q} style={{ marginBottom: 20 }}>
                <h4>{q}</h4>
                <p>{a}</p>
              </div>
            ))}
          </div>
        ))}
        <h3>Still stuck</h3>
        <p>Ask us about a specific lot or order. Include your order number or the SKU you&apos;re asking about and we&apos;ll get to it faster.</p>
        <Link className="btn" to="/shop">Browse the catalogue ↗</Link>{" "}
        <Link className="btn" to="/coa">COA Portal ↗</Link>
        <p>For laboratory research use only. All products are sold strictly for in-vitro research and not for human consumption, veterinary use, or any therapeutic or diagnostic application. We ship worldwide via FedEx Express.</p>
      </article>
    </>
  );
}
export function Shipping() {
  return (
    <>
      <Heading
        title="Shipping & fulfillment."
        subtitle="Fast worldwide delivery, fully tracked, with free shipping on orders $500+."
      />
      <article className="article quality-article">
        <h3>Dispatch</h3>
        <p>All orders ship from China. Once payment clears, orders ship within 24 hours, Monday to Friday. Weekend orders go out on Monday. Tracking details are sent via WhatsApp or email the moment your order ships.</p>
        <h3>Cost and carrier</h3>
        <p>Shipping is $15 per order, or complimentary on orders of $500 or more, with no coupon needed. We ship worldwide via FedEx Express — fully tracked, to street addresses worldwide.</p>
        <h3>Packaging</h3>
        <p>Orders ship in plain outer packaging with no contents listed on the outside, with discreet packaging on every order — standard for laboratory shipments. Delivery doesn&apos;t require a signature, and there&apos;s no option to add one at checkout; if signature on delivery matters, contact us before it ships.</p>
        <p>If you can only receive to a PO Box, contact us before ordering.</p>
        <h3>Package Protection</h3>
        <p>Package Protection is optional at checkout, charged at 2.5% of the order subtotal (minimum $0.99), shown as a separate line and removable. A protected parcel that is lost, stolen or damaged can be replaced or refunded with your order number and photos. A parcel shipped without Package Protection becomes the carrier&apos;s responsibility once accepted.</p>
        <h3>Storage</h3>
        <p>Lyophilized compounds are stored sealed at 2–8°C, desiccated and protected from light. Bacteriostatic water is stored at room temperature. Check the product page for the storage detail of each compound.</p>
        <h3>Damaged, missing or re-verification</h3>
        <p>Research materials can&apos;t be returned once shipped. If a protected shipment arrives damaged — or doesn&apos;t arrive — contact us with your order number and we&apos;ll replace or refund it. Orders shipped without Package Protection become the carrier&apos;s responsibility once accepted. Lots that fail independent re-verification are covered under our re-verification policy.</p>
        <p>If an order hasn&apos;t shipped, contact us within an hour of ordering and we&apos;ll change or cancel it. Once a tracking number is generated, the package is already moving and can&apos;t be recalled.</p>
        <Link className="btn" to="/shop">Browse the catalogue ↗</Link>{" "}
        <Link className="btn" to="/faq">FAQ ↗</Link>
      </article>
    </>
  );
}
export function Story() {
  return (
    <article className="article brand-article">
      <span className="eyebrow">ABOUT US</span>
      <h1>Research peptides, plainly listed.</h1>
      <img src="/images/aurelis-hero.svg" alt="Tideora packaging concepts" />
      <p>
        TIDEORA sells research peptides by the package: GLP-series compounds,
        single peptides and pre-made blends, in sealed vials, priced in USD.
        Thirty products, eighty-two package specifications.
      </p>
      <p>
        We are a storefront, not a laboratory. Our catalogue is TIDEORA's own
        listing — names, package labels and prices — checked on October 23,
        2026. Batch documentation is handled separately: ask us on WhatsApp
        for the lot-specific COA before you pay, and we will share
        that batch's document or tell you if one is not yet available.
      </p>
      <p>
        Everything here is supplied for laboratory research use only. It is not
        a medicine or a supplement, and it is not for human or veterinary use.
        Orders are placed on this site; payment is then arranged with us on
        WhatsApp, using the button at the right of every page.
      </p>
      <Link className="btn" to="/shop">
        Browse the catalogue ↗
      </Link>
    </article>
  );
}
export function Privacy() {
  return (
    <article className="article">
      <h1>Privacy policy</h1>
      <p>
        In this Cloudflare front-end build, your account details, delivery
        addresses, orders, favorites and subscription email are stored only in
        this browser — there is no server-side account or password check in
        this build, so do not reuse a password you use elsewhere. Your
        shopping bag is also stored in this browser.
      </p>
      <p>
        Selecting Pay via WhatsApp opens a message draft containing your order
        number, items and total. The message does not include your shipping
        address or contact details and is not sent automatically.
      </p>
      <p>
        We do not sell or share your details. To have your account, addresses or
        email subscription removed, message us on WhatsApp using the button on
        any page.
      </p>
    </article>
  );
}
