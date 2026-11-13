import React from "react";
import './styles.scss';

const Wrapper = ({ headertext, children, footer = false, wide = false, headerLeftType='back', headerRightType="whatsapp" }) => {
  // Conditionally assign the className based on the footer / wide props
  const wrapperClass = ["wrapper", footer && "isFooter", wide && "wrapper--wide"].filter(Boolean).join(" ");

  return (
    <div className={wrapperClass}>
      {/* The app supplies the header now (see ChromeShell). This used to
          render CaterKart's own, which stacked a second one under it.
          The props are still accepted so no call site had to change. */}
      <main>{children}</main>
    </div>
  );
};

export default Wrapper;
