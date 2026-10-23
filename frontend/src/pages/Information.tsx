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
    body: "Add the packages you want to your bag, sign in, and place the order. The order is created as awaiting payment and the stock is set aside for you; nothing is charged on this site. Open your order history and select Pay via WhatsApp — that opens a message to us with your order number, items and total already written out, which you send when you are ready. We confirm payment, then dispatch. Shipping is $15 per order, or complimentary above $299 before discounts, and WELCOME10 takes 10% off a first order.",
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
        title="Specifications & pricing."
        subtitle="Where every name, package label and price on this site comes from."
      />
      <article className="article quality-article">
        <span className="eyebrow">SOURCES</span>
        <h2>
          Nothing inferred.
          <br />
          Everything linked.
        </h2>
        <p>
          The 30 products and 82 package specifications in this catalogue follow
          the public YuanTid listing, checked on October 23, 2026. Every product
          page links the listing its details came from.
        </p>
        <div className="quality-list">
          {[
            [
              "Names as published",
              "Peptide names, product codes and catalogue photographs are reproduced as they appear in the source listing. We do not rename or re-group products.",
            ],
            [
              "Package labels, unchanged",
              "A label such as 332 5mg*10vials is quoted in full. Where the source publishes a code only — RT10, BB20 — we keep the code and do not infer a strength or a vial count.",
            ],
            [
              "Prices with a date",
              "Each price is a USD snapshot taken on the date shown on the product page. Select a package to see the price that applies to it; shipping is added at checkout.",
            ],
            [
              "What we do not claim",
              "We publish no purity figures, no HPLC or mass-spectrometry results, no certificates of analysis and no third-party test reports. Documentation of that kind can only come from the manufacturer, not from us.",
            ],
          ].map(([title, body], i) => (
            <section key={title}>
              <span>0{i + 1}</span>
              <div>
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
            </section>
          ))}
        </div>
        <Link className="btn" to="/shop">
          Browse the catalogue ↗
        </Link>
      </article>
    </>
  );
}
export function Story() {
  return (
    <article className="article brand-article">
      <span className="eyebrow">ABOUT US</span>
      <h1>Research peptides, plainly listed.</h1>
      <img src="/images/aurelis-hero.svg" alt="Aurelis packaging concepts" />
      <p>
        AURELIS sells research peptides by the package: GLP-series compounds,
        single peptides and pre-made blends, in sealed vials, priced in USD.
        Thirty products, eighty-two package specifications.
      </p>
      <p>
        We are a storefront, not a laboratory. Our catalogue follows the public
        YuanTid listing — names, package labels and prices — with the original
        listing linked from every product page and the date we checked it. We
        make no purity or testing claims of our own.
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
        This storefront stores your account details, hashed password, delivery
        addresses, orders, favorites and subscription email. Your shopping bag
        is stored in this browser.
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
