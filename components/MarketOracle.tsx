import React, { useEffect, useState } from 'react';
import Card from './ui/Card';

interface Props {
  telemetry: any;
  fetchOracle: () => Promise<any>;
}

const MarketOracle: React.FC<Props> = ({ fetchOracle }) => {

  const [oracleText, setOracleText] = useState('Loading Oracle...');
  const [sentiment, setSentiment] = useState('NEUTRAL');

  useEffect(() => {

    const loadOracle = async () => {

      try {

        const data = await fetchOracle();

        if (data?.oracle_text) {
          setOracleText(data.oracle_text);
        }

        if (data?.sentiment) {
          setSentiment(data.sentiment);
        }

      } catch (err) {

        console.error('Oracle Error:', err);

      }

    };

    loadOracle();

    const interval = setInterval(loadOracle, 10000);

    return () => clearInterval(interval);

  }, [fetchOracle]);

  return (

    <Card className="p-4">

      <div className="flex items-center justify-between mb-4">

        <h3 className="text-lg font-bold">
          Market Oracle
        </h3>

        <span className="text-sm">
          {sentiment}
        </span>

      </div>

      <p className="text-sm leading-relaxed">
        {oracleText}
      </p>

    </Card>

  );

};

export default MarketOracle;