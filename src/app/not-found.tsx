import Link from "next/link";

export default function NotFound() {
  return (
    <main className="textmap" data-testid="not-found">
      <h1>Nothing in this corner.</h1>
      <p>
        <Link href="/">Back to the room</Link> or see the <Link href="/map">text version</Link>.
      </p>
    </main>
  );
}
