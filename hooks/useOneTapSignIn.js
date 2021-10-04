import { useEffect, useState } from "react";
import { useSession, signIn, SignInOptions } from "next-auth/client";

const useOneTapSignin = (opt) => {
  const { status } = useSession();
  const isSignedIn = status === "authenticated";
  const { parentContainerId } = opt || {};
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isLoading && !isSignedIn) {
      const { google } = window;
      if (google) {
        google.accounts.id.initialize({
          client_id: process.env.NEXT_PUBLIC_GOOGLE_ID,
          callback: async (response) => {
            setIsLoading(true);

            // Here we call our Provider with the token provided by google
            await signIn("googleonetap", {
              credential: response.credential,
              redirect: true,
              ...opt,
            });
            setIsLoading(false);
          },
          prompt_parent_id: parentContainerId,
          style:
            "position: absolute; top: 100px; right: 30px;width: 0; height: 0; z-index: 1001;",
        });

        // Here we just console.log some error situations and reason why the google one tap
        // is not displayed. You may want to handle it depending on yuor application
        google.accounts.id.prompt((notification) => {
          if (notification.isNotDisplayed()) {
            console.log(
              "getNotDisplayedReason",
              notification.getNotDisplayedReason()
            );
          } else if (notification.isSkippedMoment()) {
            console.log("isSkippedMoment", notification.getSkippedReason());
          } else if (notification.isDismissedMoment()) {
            console.log("isDismissedMoment", notification.getDismissedReason());
          }
        });
      }
    }
  }, [isLoading, isSignedIn, parentContainerId]);

  return { isLoading, isSignedIn };
};

export default useOneTapSignin;
