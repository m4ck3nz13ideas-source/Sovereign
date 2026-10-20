import { TopBar } from "@/components/ui";

/**
 * Words live in Search (Mackenzie, 20 October): looking up what a group means
 * by a word is a kind of looking something up. They also show inline on a
 * proposal — tap an underlined word to see what people take it to mean.
 */
export default function WordsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopBar title="Search" back="/home" />
      {children}
    </>
  );
}
