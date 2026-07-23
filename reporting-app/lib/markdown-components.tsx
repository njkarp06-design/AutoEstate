import type { Components } from "react-markdown";

export const markdownComponents: Components = {
  h2: (props) => (
    <h2
      className="mt-6 mb-2 border-t border-card-border pt-4 text-base font-semibold first:mt-0 first:border-t-0 first:pt-0"
      {...props}
    />
  ),
  ul: (props) => <ul className="my-2 list-disc space-y-1 pl-5" {...props} />,
  strong: (props) => <strong className="font-semibold" {...props} />,
  hr: () => null, // section breaks are handled by the h2 top border instead
  p: (props) => <p className="mb-2 last:mb-0" {...props} />,
};
