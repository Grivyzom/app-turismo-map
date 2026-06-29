import React from 'react';

export const CloudShadows = React.memo(() => {
  return (
    <div className="cloud-shadows-container">
      <div
        className="cloud-shadow"
        style={{ top: '10%', left: '-20%', animationDelay: '0s', width: '800px', height: '500px' }}
      />
      <div
        className="cloud-shadow"
        style={{ top: '40%', left: '-40%', animationDelay: '15s', width: '600px', height: '400px' }}
      />
      <div
        className="cloud-shadow"
        style={{ top: '70%', left: '-10%', animationDelay: '35s', width: '900px', height: '600px' }}
      />
    </div>
  );
});
