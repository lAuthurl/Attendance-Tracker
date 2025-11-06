import { Link } from "expo-router";
import { openBrowserAsync } from "expo-web-browser";
import { type ComponentProps } from "react";
import { Platform } from "react-native";

type Props = Omit<ComponentProps<typeof Link>, "href"> & {
  href: ComponentProps<typeof Link>["href"];
};

export function ExternalLink({ href, ...rest }: Props) {
  return (
    <Link
      target="_blank"
      {...rest}
      href={href}
      onPress={async (event) => {
        if (Platform.OS !== "web") {
          // Prevent the default behavior of linking to the default browser on native.
          event.preventDefault();
          // Ensure href is a string before opening in browser. Link's href can be an object.
          let url: string;
          if (typeof href === "string") {
            url = href;
          } else if (href && typeof href === "object" && "pathname" in href) {
            // href may be an object like { pathname, params }
            // Build a basic path string; params are omitted here.
            // This covers the common case where a plain path string is wrapped.
            // If you need full URL building, enhance this logic.
            // @ts-ignore
            url = href.pathname;
          } else {
            url = String(href);
          }

          // Open the link in an in-app browser.
          await openBrowserAsync(url);
        }
      }}
    />
  );
}
